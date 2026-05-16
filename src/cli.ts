#!/usr/bin/env node
/**
 * whcli — Willhaben.at CLI for agent automation.
 *
 * Thin dispatcher: parse args → auth gate → delegate to command handlers.
 * All business logic lives in src/agents/, all formatting in src/commands/.
 */

import { checkAuth } from './agents/auth.js';
import { seedCategories, seedRegions, seedVehicleCategories } from './agents/db.js';
import { parseArgs, getFormat, output, type OutputFormat } from './commands/shared.js';
import { cmdSearch } from './commands/search.js';
import { cmdView, cmdImages } from './commands/view.js';
import { cmdFavorites } from './commands/favorites.js';
import { cmdVehicleSearch } from './commands/vehicles.js';
import { cmdSimilar, cmdSimilarItems } from './commands/similar.js';
import { cmdAnalyze, cmdCompare } from './commands/analyze.js';
import { cmdOverview } from './commands/overview.js';
import { cmdMessage, cmdChats } from './commands/chats.js';
import { cmdAuth, cmdSeller, cmdLocations, cmdHistory, cmdWishlist, cmdTree, cmdHelp } from './commands/misc.js';
import { getImmoFilters } from './agents/search-immo.js';
import * as fs from 'fs';
import * as path from 'path';

const VERSION = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'package.json'), 'utf-8')).version;

// ─── Auth Router ────────────────────────────────────────────────────────
const PUBLIC_COMMANDS = new Set([
  'search', 'car', 'moto', 'van', 'caravan', 'similar', 'similar-items',
  'tree', 'locations', 'view', 'images', 'analyze', 'compare', 'seller',
  'history', 'help', 'immo-filters',
]);

const AUTH_COMMANDS = new Set([
  'favorites', 'message', 'chats', 'wishlist',
]);

async function requireAuth(command: string, format: OutputFormat, flags: Record<string, string | boolean>) {
  const { isAuthenticated, user, error } = await checkAuth(flags.cdp === true);
  if (!isAuthenticated) {
    output({
      error: `Command "${command}" requires authentication.`,
      hint: error?.includes('v20') ? 'Run: whcli auth --cdp' : 'Run: whcli auth  (or: whcli auth --cdp)',
      detail: error || 'No valid session cookies found',
    }, format);
    process.exit(1);
  }
  if (format === 'text') {
    process.stderr.write(`Authenticated as ${user?.name || 'user'}\n`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────
async function main() {
  seedCategories();
  seedRegions();
  seedVehicleCategories();

  const args = process.argv.slice(2);

  if (args.includes('-v') || args.includes('--version')) {
    console.log(`whcli v${VERSION}`);
    process.exit(0);
  }

  const { command, positional, flags } = parseArgs(args);
  const format = getFormat(flags);

  if (AUTH_COMMANDS.has(command)) {
    await requireAuth(command, format, flags);
  }

  switch (command) {
    case 'search':        return await cmdSearch(positional, flags, format);
    case 'car':
    case 'moto':
    case 'van':
    case 'caravan':       return await cmdVehicleSearch(command, positional, flags, format);
    case 'similar':       return await cmdSimilar(positional, flags, format);
    case 'similar-items': return await cmdSimilarItems(positional, flags, format);
    case 'tree':          return await cmdTree(positional, flags, format);
    case 'locations':     return cmdLocations(format, flags);
    case 'view':          return await cmdView(positional, flags, format);
    case 'images':        return await cmdImages(positional, flags, format);
    case 'analyze':       return await cmdAnalyze(positional, flags, format);
    case 'compare':       return await cmdCompare(positional, flags, format);
    case 'seller':        return await cmdSeller(positional, flags, format);
    case 'auth':          return await cmdAuth(flags, format);
    case 'message':       return await cmdMessage(positional, flags, format);
    case 'chats':         return await cmdChats(positional, flags, format);
    case 'favorites':     return await cmdFavorites(positional, flags, format);
    case 'history':       return cmdHistory(format);
    case 'wishlist':      return cmdWishlist(positional, flags, format);
    case 'immo-filters':  return await cmdImmoFilters(positional, flags, format);
    case 'overview':      return await cmdOverview(positional, flags, format);
    case 'help':
    case '--help':
    case '-h':            return cmdHelp(format);
    case 'version':       return console.log(`whcli v${VERSION}`);
    default:
      output({ error: `Unknown command: ${command}. Use 'whcli help' for usage.` }, format);
      process.exit(1);
  }
}

async function cmdImmoFilters(positional: string[], flags: Record<string, string | boolean>, format: OutputFormat) {
  const searchId = typeof flags.type === 'string' ? undefined : undefined; // resolve later
  const typeMap: Record<string, number> = { alle: 90, mietwohnung: 131, eigentumswohnung: 101, haus: 102, miethaus: 132, grundstueck: 14, gewerbe: 15, neubau: 42 };
  const typeName = typeof flags.type === 'string' ? flags.type.toLowerCase() : 'eigentumswohnung';
  const sid = typeMap[typeName] || 101;
  const filters = await getImmoFilters(sid);
  if (format === 'text') {
    console.log(`\n📐 Server-side filter: ${typeName} (searchId=${sid})\n`);
    let lastGroup = '';
    for (const f of filters) {
      if (f.group !== lastGroup) { console.log(`  ${f.group}`); lastGroup = f.group; }
      const param = f.params.join(', ');
      const sel = f.selectionType === 'MULTI_SELECT' ? 'multi' : 'single';
      console.log(`    ${f.label.padEnd(16)} ${param.padEnd(35)} [${f.type}] ${sel}`);
    }
    console.log();
    return;
  }
  output(filters, format);
}

main().catch(e => {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
});
