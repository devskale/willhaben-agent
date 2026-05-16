/**
 * Misc command handlers: auth, seller, locations, history, wishlist, tree, help.
 */

import { checkAuth } from '../agents/auth.js';
import { getSeller, getCategoryTree } from '../agents/search.js';
import { FALLBACK_LOCATIONS, resolveLocationInput } from '../agents/locations.js';
import { getSearchHistory, getWishlist, addWishlist, removeWishlist, toggleWishlist } from '../agents/db.js';
import { output, type OutputFormat } from './shared.js';

export async function cmdAuth(flags: Record<string, string | boolean>, format: OutputFormat) {
  try {
    const auth = await checkAuth(flags.cdp === true);
    output({ authenticated: auth.isAuthenticated, user: auth.user, error: auth.error }, format);
  } catch (e) {
    output({ error: e instanceof Error ? e.message : 'Auth check failed' }, format);
    process.exit(1);
  }
}

export async function cmdSeller(positional: string[], flags: Record<string, string | boolean>, format: OutputFormat) {
  const sellerId = positional[0];
  if (!sellerId) { output({ error: 'Missing seller ID' }, format); process.exit(1); }
  try {
    output(await getSeller(sellerId), format);
  } catch (e) {
    output({ error: e instanceof Error ? e.message : 'Failed to fetch seller' }, format);
    process.exit(1);
  }
}

export function cmdLocations(format: OutputFormat, flags: Record<string, string | boolean>) {
  let locations = Object.entries(FALLBACK_LOCATIONS).map(([id, name]) => ({ id: Number(id), name }));
  const parent = typeof flags.parent === 'string' ? flags.parent : undefined;
  if (parent) {
    const prefix = parent === '900' ? 'Wien' : undefined;
    if (prefix) locations = locations.filter(l => l.name.startsWith(prefix + ' '));
  } else {
    locations = locations.filter(l => l.id < 1000);
  }
  output(locations, format);
}

export function cmdHistory(format: OutputFormat) {
  output(getSearchHistory(), format);
}

export function cmdWishlist(positional: string[], flags: Record<string, string | boolean>, format: OutputFormat) {
  const subcommand = positional[0];

  if (!subcommand || subcommand === 'list') {
    const all = typeof flags.all === 'boolean' ? false : true;
    output(getWishlist(all), format);
    return;
  }

  if (subcommand === 'add') {
    const searchQuery = positional[1];
    if (!searchQuery) {
      output({ error: 'Usage: whcli wishlist add <query> [--description <text>] [--category <id>] [--max-price <amount>] [--notes <text>]' }, format);
      process.exit(1);
    }
    const description = typeof flags.description === 'string' ? flags.description : undefined;
    const categoryId = typeof flags.category === 'string' ? parseInt(flags.category, 10) : undefined;
    const priceMax = typeof flags['max-price'] === 'string' ? parseFloat(flags['max-price']) : undefined;
    const notes = typeof flags.notes === 'string' ? flags.notes : undefined;
    output(addWishlist(searchQuery, description, categoryId, priceMax, notes), format);
    return;
  }

  if (subcommand === 'remove') {
    const id = parseInt(positional[1], 10);
    if (isNaN(id)) { output({ error: 'Usage: whcli wishlist remove <id>' }, format); process.exit(1); }
    output({ removed: removeWishlist(id), id }, format);
    return;
  }

  if (subcommand === 'toggle') {
    const id = parseInt(positional[1], 10);
    if (isNaN(id)) { output({ error: 'Usage: whcli wishlist toggle <id>' }, format); process.exit(1); }
    output({ toggled: toggleWishlist(id), id }, format);
    return;
  }

  output({ error: `Unknown wishlist subcommand: ${subcommand}. Use list/add/remove/toggle.` }, format);
  process.exit(1);
}

export async function cmdTree(positional: string[], flags: Record<string, string | boolean>, format: OutputFormat) {
  const categoryId = positional[0];
  const keyword = typeof flags.keyword === 'string' ? flags.keyword : undefined;

  try {
    const tree = await getCategoryTree(categoryId, keyword);
    if (format === 'text') {
      if (tree.categoryName) console.log(`\n📂 ${tree.categoryName} (ID: ${tree.categoryId})\n`);
      else console.log('\n📂 Kategorien\n');
      const maxName = tree.children.reduce((m, c) => Math.max(m, (c.name || '').length), 0);
      for (const c of tree.children) {
        const name = (c.name || '').padEnd(maxName + 2);
        const count = c.count !== undefined ? c.count.toLocaleString('de-AT') + 'x' : '';
        console.log(`  ${c.id.padEnd(8)} ${count.padStart(10)}   ${name}`);
      }
      console.log();
    } else {
      output(tree, format);
    }
  } catch (e) {
    output({ error: e instanceof Error ? e.message : 'Failed to fetch category tree' }, format);
    process.exit(1);
  }
}

export function cmdHelp(format: OutputFormat) {
  const COMMANDS: Record<string, string> = {
    search: 'Search for listings (returns items + categories)',
    car: 'Search cars: whcli car [keyword] [--fuel diesel] [--max-price 5000] [--type SUV]',
    moto: 'Search motorrad/quad: whcli moto [keyword] [--type enduro] [--max-price 3000]',
    van: 'Search nutzfahrzeug/pickup: whcli van [keyword] [--max-price 10000]',
    caravan: 'Search wohnwagen/wohnmobil: whcli caravan [keyword] [--max-price 20000]',
    similar: 'Find similar listings: whcli similar <adId | product name> [--item]',
    tree: 'Browse category tree (optional: category ID to drill down)',
    wishlist: 'Manage search wishlist (list / add / remove / toggle)',
    locations: 'List Austrian states (Bundesländer) for location filtering',
    view: 'View listing details',
    images: 'Download/view listing images',
    analyze: 'Analyze search results (stats, best deals, market overview)',
    compare: 'Compare listings side-by-side',
    seller: 'Get seller info',
    auth: 'Check authentication status',
    message: 'Send a message to a seller (requires authentication)',
    chats: 'List conversations or view messages (optional: conversation UUID)',
    favorites: 'Manage favorites (list/download/summary/folders/save/remove)',
    history: 'Show search history',
    overview: 'Immo overview: stats by district/area',
    help: 'Show this help',
    version: 'Show version',
  };

  output({
    name: 'whcli',
    description: 'Willhaben.at CLI for agent automation',
    commands: Object.entries(COMMANDS).map(([name, desc]) => ({ name, description: desc })),
    searchFlags: [
      { flag: '--category <id>', desc: 'Filter by category ID' },
      { flag: '--location <ids>', desc: 'Comma-separated area IDs' },
      { flag: '--vertical <name>', desc: 'Vertical: marktplatz|immobilien|auto' },
      { flag: '--sort <mode>', desc: 'price-asc | price-desc | newest' },
      { flag: '--max-price <amount>', desc: 'Max price filter' },
      { flag: '--min-price <amount>', desc: 'Min price filter' },
      { flag: '--type <type>', desc: 'Immo/vehicle type filter' },
      { flag: '--private', desc: 'Private sellers only' },
      { flag: '--text', desc: 'Pretty table output' },
      { flag: '--json', desc: 'JSON output (default)' },
    ],
  }, format);
}
