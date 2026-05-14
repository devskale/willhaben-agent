#!/usr/bin/env node
import { checkAuth } from "./agents/auth.js";
import { searchItems, getListingDetails, getSeller, getCategoryTree, getListingImages, getImmoOverview } from "./agents/search.js";
import type { ImmoFilters } from "./agents/search.js";
import { FALLBACK_LOCATIONS } from "./agents/locations.js";
import {
  buildImmoFilters,
  parseAreaIds,
  resolveAreaNames,
  getChildAreas,
  fmtNum,
  fmtCur,
  fmtPpm2,
  strFlag,
  numFlag,
  intFlag,
  boolFlag,
} from "./lib/cli-helpers.js";
import {
  getStarredItems,
  toggleStar,
  getSearchHistory,
  addSearchHistory,
  getWishlist,
  addWishlist,
  removeWishlist,
  toggleWishlist,
  seedCategories,
  seedRegions,
} from "./agents/db.js";
import { sendMessage, getConversations, getMessages } from "./agents/messaging.js";
import {
  filterByType,
  filterBySize,
  filterByRooms,
  filterByPrice,
  filterByKeyword,
  excludeByKeyword,
  analyzeListings,
  compareListings,
} from "./lib/analysis.js";
import * as fs from "fs";
import * as path from "path";

const COMMANDS = {
  search: "Search for listings (returns items + categories)",
  tree: "Browse category tree (optional: category ID to drill down)",
  wishlist: "Manage search wishlist (list / add / remove / toggle)",
  locations: "List Austrian states (Bundesländer) for location filtering",
  view: "View listing details",
  images: "Download/view listing images",
  analyze: "Analyze search results (stats, best deals, market overview)",
  compare: "Compare listings side-by-side",
  seller: "Get seller info",
  auth: "Check authentication status",
  message: "Send a message to a seller (requires authentication)",
  chats: "List conversations or view messages (optional: conversation UUID)",
  favorites: "Manage favorites (list/add/remove)",
  history: "Show search history",
  overview: "Immo overview: stats by district/area for Mietwohnung, Eigentumswohnung, Haus",
  help: "Show this help",
};

type OutputFormat = "json" | "text";

function output(data: unknown, format: OutputFormat) {
  if (format === "json") {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(data);
  }
}

function parseArgs(args: string[]): {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
} {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (arg.startsWith("-")) {
      const key = arg.slice(1);
      flags[key] = true;
    } else {
      positional.push(arg);
    }
  }

  return { command: positional[0] || "help", positional: positional.slice(1), flags };
}

function getFormat(flags: Record<string, string | boolean>): OutputFormat {
  if (flags.json === true) return "json";
  if (flags.text === true) return "text";
  return "json"; // Default to JSON for agent consumption
}

async function cmdSearch(positional: string[], flags: Record<string, string | boolean>, format: OutputFormat) {
  const query = positional.join(" ");
  if (!query) {
    output({ error: "Missing search query" }, format);
    process.exit(1);
  }

  const page = typeof flags.page === "string" ? parseInt(flags.page, 10) : 1;
  const category = typeof flags.category === "string" ? flags.category : undefined;
  const sortBy = typeof flags.sort === "string" ? flags.sort : undefined; // price-asc, price-desc, newest
  const privateOnly = flags.private === true;
  const maxPrice = typeof flags["max-price"] === "string" ? parseFloat(flags["max-price"]) : undefined;
  const minPrice = typeof flags["min-price"] === "string" ? parseFloat(flags["min-price"]) : undefined;
  const propertyType = typeof flags.type === "string" ? flags.type : undefined;
  const minSize = typeof flags["min-size"] === "string" ? parseFloat(flags["min-size"]) : undefined;
  const maxSize = typeof flags["max-size"] === "string" ? parseFloat(flags["max-size"]) : undefined;
  const rooms = typeof flags.rooms === "string" ? parseInt(flags.rooms, 10) : undefined;
  const minRooms = typeof flags["min-rooms"] === "string" ? parseInt(flags["min-rooms"], 10) : undefined;
  
  // Parse location IDs (comma-separated)
  let areaIds: number[] | undefined;
  if (typeof flags.location === "string") {
    areaIds = flags.location
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
  }

  const vertical = typeof flags.vertical === "string" ? flags.vertical : undefined;
  try {
    // Build server-side immo filters (shared helper, single source of truth)
    const { filters: immoFilters, searchId: immoSearchId, isImmo } = buildImmoFilters(flags);
    const result = await searchItems(query, category, page, areaIds, vertical, immoFilters, immoSearchId);

    // Apply client-side filters (skip when server-side immo filters are active)
    let items = result.items;

    if (!isImmo) {
      if (maxPrice !== undefined && !isNaN(maxPrice)) {
        items = items.filter((i) => i.price !== null && i.price <= maxPrice);
      }
      if (minPrice !== undefined && !isNaN(minPrice)) {
        items = items.filter((i) => i.price !== null && i.price >= minPrice);
      }
      if (propertyType) items = filterByType(items, propertyType);
      items = filterBySize(items, minSize, maxSize);
      items = filterByRooms(items, rooms, minRooms);
    }

    // Keyword title filters (work for all verticals)
    const keywords = strFlag(flags, 'keyword');
    if (keywords) items = filterByKeyword(items, keywords.split(',').map(s => s.trim()));
    const excludes = strFlag(flags, 'exclude');
    if (excludes) items = excludeByKeyword(items, excludes.split(',').map(s => s.trim()));

    // Sorting
    if (sortBy === "price-asc") {
      items.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    } else if (sortBy === "price-desc") {
      items.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    } else if (sortBy === "newest") {
      items.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0)); // higher ID = newer
    }

    // Private seller filter — now uses isPrivate from JSON API enrichment
    if (privateOnly && items.length > 0) {
      // Check if items have isPrivate from API enrichment
      const hasApiData = items.some(i => i.isPrivate !== undefined);
      
      if (hasApiData) {
        // Fast path: use pre-fetched isPrivate flag
        items = items.filter(i => i.isPrivate === true);
      } else {
        // Fallback: detail lookup (slow, rate-limited)
        const privateItems = [];
        for (const item of items.slice(0, 20)) {
          try {
            const detail = await getListingDetails(item.id);
            const attrs = detail.attributes || {};
            const isPrivate = attrs.ISPRIVATE?.[0] === "1" || attrs.DEALER?.[0] === "0";
            if (isPrivate) {
              privateItems.push({ ...item, _isPrivate: true });
            }
          } catch {
            // Skip items that fail detail lookup
          }
        }
        items = privateItems;
      }
    }

    // Record in history with result metadata
    try {
      const prices = items.map(i => i.price).filter((p): p is number => p !== null);
      addSearchHistory(
        query,
        result.totalFound,
        category,
        prices.length > 0 ? Math.min(...prices) : undefined,
        prices.length > 0 ? Math.max(...prices) : undefined,
        areaIds?.[0],
      );
    } catch {
      // Ignore history errors
    }

    // Text format: pretty table output
    if (format === "text") {
      printSearchTable(query, result.totalFound, items, result.categories);
      return;
    }

    output({ ...result, items }, format);
  } catch (e) {
    output({ error: e instanceof Error ? e.message : "Search failed" }, format);
    process.exit(1);
  }
}

function printSearchTable(query: string, totalFound: number, items: any[], categories: any[]) {
  console.log(`\n🔍  "${query}"  —  ${totalFound.toLocaleString()} Treffer${items.length < totalFound ? ` (zeige ${items.length})` : ""}\n`);

  if (categories.length > 0) {
    console.log("📂 Kategorien:");
    for (const c of categories.slice(0, 5)) {
      console.log(`   ${c.id.toString().padStart(8)}   ${(c.count || 0).toLocaleString().padStart(8)}x   ${c.name}`);
    }
    console.log();
  }

  if (items.length === 0) {
    console.log("   Keine Treffer gefunden.\n");
    return;
  }

  for (const item of items) {
    const priv = item.isPrivate ? "👤" : "🏢";
    const price = item.priceText || "?";
    const oldPrice = item.oldPriceText ? ` ~~${item.oldPriceText}~~` : "";
    const title = (item.title || "").substring(0, 55);
    const loc = (item.location || "?").substring(0, 30);
    // Immobilien extras
    const size = item.estateSize ? `${item.estateSize}m²` : "";
    const rooms = item.rooms ? `${item.rooms}Zi` : "";
    const ppsm = item.pricePerSqm ? `€${item.pricePerSqm}/m²` : "";
    const ptype = item.propertyType || "";
    const immo = [size, rooms, ppsm].filter(Boolean).join(" ");
    const immoPad = immo ? `  ${immo}` : "";
    console.log(`  ${priv} ${price.padEnd(10)}${oldPrice.padEnd(14)}  ${title.padEnd(55)}${immoPad}  ${loc}`);
  }
  console.log();
}

async function cmdView(positional: string[], flags: Record<string, string | boolean>, format: OutputFormat) {
  const adId = positional[0];
  if (!adId) {
    output({ error: "Missing listing ID" }, format);
    process.exit(1);
  }

  // --images flag: return listing with image download URLs
  if (flags.images === true || flags["all-images"] === true) {
    try {
      const result = await getListingImages(adId);
      
      // If not --all-images, keep only first image
      if (flags["all-images"] !== true && result.images.length > 1) {
        result.images = [result.images[0]];
        result.imageCount = 1;
      }
      
      output(result, format);
      return;
    } catch (e) {
      output({ error: e instanceof Error ? e.message : "Failed to fetch images" }, format);
      process.exit(1);
    }
  }

  try {
    const detail = await getListingDetails(adId);
    output(detail, format);
  } catch (e) {
    output({ error: e instanceof Error ? e.message : "Failed to fetch listing" }, format);
    process.exit(1);
  }
}


// ─── Images Command ─────────────────────────────────────────────────────

async function cmdImages(positional: string[], flags: Record<string, string | boolean>, format: OutputFormat) {
  const adId = positional[0];
  if (!adId) {
    output({ error: "Missing listing ID. Usage: whcli images <adId> [--dir <path>] [--open]" }, format);
    process.exit(1);
  }

  try {
    const result = await getListingImages(adId);
    const images = result.images || [];

    // Download mode: save to directory
    if (flags.dir || flags.download) {
      const outDir = typeof flags.dir === "string" ? flags.dir : `./wh_images_${adId}`;
      fs.mkdirSync(outDir, { recursive: true });
      const downloaded: string[] = [];
      for (let idx = 0; idx < images.length; idx++) {
        const img = images[idx];
        const imgUrl = typeof img === "string" ? img : (img as any).url || String(img);
        const ext = imgUrl.includes("_hoved") ? "_main.jpg" : ".jpg";
        const filename = `${adId}_${idx.toString().padStart(3, "0")}${ext}`;
        const filepath = path.join(outDir, filename);
        if (!downloaded.some((d) => d === filepath)) {
          const resp = await fetch(imgUrl);
          if (resp.ok) {
            const buffer = Buffer.from(await resp.arrayBuffer());
            fs.writeFileSync(filepath, buffer);
            downloaded.push(filepath);
          }
        }
      }
      output({ adId, count: downloaded.length, dir: outDir, files: downloaded }, format);
      return;
    }

    // Default: return image URLs
    output({ adId, imageCount: images.length, images, preview: images[0] || null }, format);
  } catch (e) {
    output({ error: e instanceof Error ? e.message : "Failed to fetch images" }, format);
    process.exit(1);
  }
}

// ─── Analyze Command ─────────────────────────────────────────────────────

async function cmdAnalyze(positional: string[], flags: Record<string, string | boolean>, format: OutputFormat) {
  // Can work with piped JSON or run a fresh search
  let items;
  if (positional.length > 0 && positional[0].startsWith("{")) {
    // Piped JSON input
    try {
      const data = JSON.parse(positional.join(" "));
      items = data.items || data;
    } catch {
      output({ error: "Invalid JSON input" }, format);
      process.exit(1);
    }
  } else if (positional.join(" ").trim()) {
    // Run a search first
    const query = positional.join(" ");
    const page = typeof flags.page === "string" ? parseInt(flags.page, 10) : 1;
    const category = typeof flags.category === "string" ? flags.category : undefined;
    const maxPrice = typeof flags["max-price"] === "string" ? parseFloat(flags["max-price"]) : undefined;
    const minPrice = typeof flags["min-price"] === "string" ? parseFloat(flags["min-price"]) : undefined;
    const propertyType = typeof flags.type === "string" ? flags.type : undefined;
    const minSize = typeof flags["min-size"] === "string" ? parseFloat(flags["min-size"]) : undefined;
    const maxSize = typeof flags["max-size"] === "string" ? parseFloat(flags["max-size"]) : undefined;
    const rooms = typeof flags.rooms === "string" ? parseInt(flags.rooms, 10) : undefined;
    const sortBy = typeof flags.sort === "string" ? flags.sort : undefined;
    let areaIds: number[] | undefined;
    if (typeof flags.location === "string") {
      areaIds = flags.location.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    }
    const vertical = typeof flags.vertical === "string" ? flags.vertical : undefined;

    const { filters: immoFilters, searchId: immoSearchId, isImmo } = buildImmoFilters(flags);
    const result = await searchItems(query, category, page, areaIds, vertical, immoFilters, immoSearchId);
    items = result.items;

    if (!isImmo) {
      items = filterByPrice(items, minPrice, maxPrice);
      if (propertyType) items = filterByType(items, propertyType);
      items = filterBySize(items, minSize, maxSize);
      items = filterByRooms(items, rooms);
    }

    if (sortBy === "price-asc") items.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    else if (sortBy === "price-desc") items.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
  } else {
    output({ error: "Usage: whcli analyze <query> [flags] OR pipe JSON from 'whcli search'" }, format);
    process.exit(1);
  }

  const analysis = analyzeListings(items);
  output(analysis, format);
}

// ─── Compare Command ──────────────────────────────────────────────────────

async function cmdCompare(positional: string[], flags: Record<string, string | boolean>, format: OutputFormat) {
  const adIds = positional.filter((id) => /^\d+$/.test(id));
  if (adIds.length < 2) {
    output({ error: "Need at least 2 listing IDs. Usage: whcli compare <id1> <id2> [id3 ...]" }, format);
    process.exit(1);
  }

  try {
    const listings = [];
    for (const id of adIds) {
      const detail = await getListingDetails(id);
      listings.push(detail as any);
    }
    const comparison = compareListings(listings as any[]);
    output(comparison, format);
  } catch (e) {
    output({ error: e instanceof Error ? e.message : "Comparison failed" }, format);
    process.exit(1);
  }
}

async function cmdSeller(positional: string[], flags: Record<string, string | boolean>, format: OutputFormat) {
  const sellerId = positional[0];
  if (!sellerId) {
    output({ error: "Missing seller ID" }, format);
    process.exit(1);
  }

  try {
    const seller = await getSeller(sellerId);
    output(seller, format);
  } catch (e) {
    output({ error: e instanceof Error ? e.message : "Failed to fetch seller" }, format);
    process.exit(1);
  }
}

async function cmdAuth(flags: Record<string, string | boolean>, format: OutputFormat) {
  const useCDP = flags.cdp === true;

  try {
    const auth = await checkAuth(useCDP);
    output(
      {
        authenticated: auth.isAuthenticated,
        user: auth.user,
        error: auth.error,
      },
      format
    );
  } catch (e) {
    output({ error: e instanceof Error ? e.message : "Auth check failed" }, format);
    process.exit(1);
  }
}

async function cmdFavorites(positional: string[], flags: Record<string, string | boolean>, format: OutputFormat) {
  const subcommand = positional[0] || "list";

  if (subcommand === "list") {
    const items = getStarredItems();
    output(items, format);
    return;
  }

  if (subcommand === "add" || subcommand === "remove") {
    const listingJson = flags.data;
    if (typeof listingJson !== "string") {
      output({ error: "Missing --data with listing JSON" }, format);
      process.exit(1);
    }

    try {
      const listing = JSON.parse(listingJson);
      const isAdd = subcommand === "add";
      const currentlyStarred = toggleStar(listing);

      if (isAdd && !currentlyStarred) {
        // toggleStar returned false meaning it was already unstarred and we just added it
        output({ success: true, action: "added", id: listing.id }, format);
      } else if (!isAdd && currentlyStarred) {
        // toggleStar returned true meaning it was starred and we just removed it
        output({ success: true, action: "removed", id: listing.id }, format);
      } else {
        output({ success: true, action: isAdd ? "already-added" : "already-removed", id: listing.id }, format);
      }
    } catch (e) {
      output({ error: "Invalid listing JSON" }, format);
      process.exit(1);
    }
    return;
  }

  output({ error: `Unknown favorites subcommand: ${subcommand}` }, format);
  process.exit(1);
}

function cmdHistory(format: OutputFormat) {
  const history = getSearchHistory();
  output(history, format);
}

function cmdWishlist(positional: string[], flags: Record<string, string | boolean>, format: OutputFormat) {
  const subcommand = positional[0];

  if (!subcommand || subcommand === 'list') {
    const all = typeof flags.all === 'boolean' ? false : true;
    const items = getWishlist(all);
    output(items, format);
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
    const item = addWishlist(searchQuery, description, categoryId, priceMax, notes);
    output(item, format);
    return;
  }

  if (subcommand === 'remove') {
    const id = parseInt(positional[1], 10);
    if (isNaN(id)) {
      output({ error: 'Usage: whcli wishlist remove <id>' }, format);
      process.exit(1);
    }
    const ok = removeWishlist(id);
    output({ removed: ok, id }, format);
    return;
  }

  if (subcommand === 'toggle') {
    const id = parseInt(positional[1], 10);
    if (isNaN(id)) {
      output({ error: 'Usage: whcli wishlist toggle <id>' }, format);
      process.exit(1);
    }
    const ok = toggleWishlist(id);
    output({ toggled: ok, id }, format);
    return;
  }

  output({ error: `Unknown wishlist subcommand: ${subcommand}. Use list/add/remove/toggle.` }, format);
  process.exit(1);
}

async function cmdTree(positional: string[], flags: Record<string, string | boolean>, format: OutputFormat) {
  const categoryId = positional[0];
  const keyword = typeof flags.keyword === "string" ? flags.keyword : undefined;

  try {
    const tree = await getCategoryTree(categoryId, keyword);
    output(tree, format);
  } catch (e) {
    output({ error: e instanceof Error ? e.message : "Failed to fetch category tree" }, format);
    process.exit(1);
  }
}

function cmdLocations(format: OutputFormat, flags: Record<string, string | boolean>) {
  let locations = Object.entries(FALLBACK_LOCATIONS).map(([id, name]) => ({
    id: Number(id),
    name,
  }));
  
  // Filter by parent (e.g. --parent 900 shows only Wien districts)
  const parent = typeof flags.parent === 'string' ? flags.parent : undefined;
  if (parent) {
    const prefix = parent === '900' ? 'Wien' : undefined;
    if (prefix) {
      locations = locations.filter(l => l.name.startsWith(prefix + ' '));
    }
  } else {
    // Default: show only Bundesländer (id < 1000)
    locations = locations.filter(l => l.id < 1000);
  }
  output(locations, format);
}

async function cmdMessage(positional: string[], flags: Record<string, string | boolean>, format: OutputFormat) {
  const adId = positional[0];
  const message = positional.slice(1).join(" ");

  if (!adId) {
    output({ error: "Missing listing ID. Usage: whcli message <adId> <message>" }, format);
    process.exit(1);
  }

  if (!message) {
    output({ error: "Missing message. Usage: whcli message <adId> <message>" }, format);
    process.exit(1);
  }

  try {
    const result = await sendMessage({
      adId,
      message,
      copyToSender: flags["copy"] === true,
      showPhone: flags["show-phone"] === true,
      phone: typeof flags.phone === "string" ? flags.phone : undefined,
    });

    output(result, format);

    if (!result.success) {
      process.exit(1);
    }
  } catch (e) {
    output({ error: e instanceof Error ? e.message : "Failed to send message" }, format);
    process.exit(1);
  }
}

async function cmdChats(positional: string[], flags: Record<string, string | boolean>, format: OutputFormat) {
  const conversationId = positional[0];

  try {
    // If conversation ID provided, get messages for that conversation
    if (conversationId) {
      const conversation = await getMessages(conversationId);
      output(conversation, format);
      return;
    }

    // Otherwise, list all conversations
    const result = await getConversations();
    
    if (!result.success) {
      output({ error: result.error }, format);
      process.exit(1);
    }

    // Simplify output for readability
    const simplified = result.conversations.map((c) => ({
      id: c.id,
      partner: c.partnerName,
      adTitle: c.adTitle,
      adId: c.adId,
      adStatus: c.adStatus,
      price: c.adPrice,
      lastMessage: c.lastMessage?.message?.substring(0, 100),
      lastMessageAt: c.lastMessage?.timestamp,
      isMine: c.lastMessage?.isMine,
      unseen: c.unseen,
    }));

    output({ total: result.total, conversations: simplified }, format);
  } catch (e) {
    output({ error: e instanceof Error ? e.message : "Failed to fetch chats" }, format);
    process.exit(1);
  }
}

async function cmdOverview(positional: string[], flags: Record<string, string | boolean>, format: OutputFormat) {
  // Resolve area IDs: --location arg, positional args, or default to Wien districts
  const rawIds = parseAreaIds(flags);
  let areaIds = rawIds ? resolveAreaNames(rawIds) : getChildAreas(900);

  // --parent overrides to show children of that area
  const parentId = intFlag(flags, 'parent');
  if (parentId) areaIds = getChildAreas(parentId);

  // Build filters using shared helper
  const { filters: activeFilters } = buildImmoFilters(flags);

  try {
    const overview = await getImmoOverview(areaIds, undefined, 30, activeFilters);
    
    if (format === 'text') {
      // Pretty text output
      // Use shared formatters
      
      for (const [typeName, typeLabel] of [['Mietwohnung', 'MIETWOHNUNGEN'], ['Eigentumswohnung', 'EIGENTUMSWOHNUNGEN'], ['Haus kaufen', 'HÄUSER KAUFEN']] as [string, string][]) {
        console.log(`\n  ${'═'.repeat(90)}`);
        console.log(`  ${typeLabel}`);
        console.log(`  ${'═'.repeat(90)}`);
        console.log();
        console.log(`  ${'Bezirk'.padEnd(24)} ${'Angebote'.padStart(8)} ${'Preis Median'.padStart(14)} ${'m² Median'.padStart(10)} ${'€/m² Median'.padStart(12)} ${'Preis Min'.padStart(12)} ${'Preis Max'.padStart(12)}`);
        console.log(`  ${'─'.repeat(90)}`);
        
        for (const d of overview) {
          const t = d.types[typeName];
          if (!t) continue;
          const name = d.name.replace('Wien ', '').substring(0, 22);
          if (t.totalFound === 0 && typeName === 'Haus kaufen') continue;
          console.log(`  ${name.padEnd(24)} ${String(t.totalFound).padStart(8)} ${fmtCur(t.priceMedian).padStart(14)} ${fmtNum(t.sizeMedian).padStart(8)} m² ${fmtPpm2(t.ppm2Median).padStart(12)} ${fmtCur(t.priceMin).padStart(12)} ${fmtCur(t.priceMax).padStart(12)}`);
        }
        console.log();
      }
      return;
    }
    
    output(overview, format);
  } catch (e) {
    output({ error: e instanceof Error ? e.message : 'Overview failed' }, format);
    process.exit(1);
  }
}

function cmdHelp(format: OutputFormat) {
  const help = {
    name: "whcli",
    description: "Willhaben.at CLI for agent automation",
    commands: Object.entries(COMMANDS).map(([name, desc]) => ({ name, description: desc })),
    searchFlags: [
      { flag: "--category <id>", desc: "Filter by category ID" },
      { flag: "--location <ids>", desc: "Comma-separated area IDs (e.g., 900,1,3)" },
      { flag: "--vertical <name>", desc: "Vertical: marktplatz|immobilien|wohnungen|hauser|auto" },
      { flag: "--sort <mode>", desc: "price-asc | price-desc | newest" },
      { flag: "--max-price <amount>", desc: "Max price filter" },
      { flag: "--min-price <amount>", desc: "Min price filter" },
      { flag: "--type <type>", desc: "Immo type (server-side!): wohnung|mietwohnung|haus|miethaus|grundstück|gewerbe" },
      { flag: "--min-size <m²>", desc: "Min estate size in m²" },
      { flag: "--max-size <m²>", desc: "Max estate size in m²" },
      { flag: "--rooms <n>", desc: "Exact room count filter" },
      { flag: "--min-rooms <n>", desc: "Min room count filter" },
      { flag: "--keyword <kw>", desc: "Comma-separated keywords that ALL must appear in title" },
      { flag: "--exclude <kw>", desc: "Comma-separated keywords to exclude from title" },
      { flag: "--private", desc: "Private sellers only" },
      { flag: "--page <n>", desc: "Page number" },
      { flag: "--text", desc: "Pretty table output" },
      { flag: "--json", desc: "JSON output (default)" },
    ],
    examples: [
      "# Search",
      "whcli search 'pixel' --category 2722 --sort price-asc --text",
      "whcli search 'frauenkirchen' --vertical immobilien --location 7132 --text",
      "# Immobilien filters",
      "whcli search '.' --vertical immobilien --location 900 --type wohnung --max-price 300000 --text",
      "whcli search '.' --vertical immobilien --location 7100 --type haus --min-size 100 --sort price-asc --text",
      "# Analyze market",
      "whcli analyze 'wohnung' --vertical immobilien --location 900 --max-price 500000 --type wohnung",
      "whcli search 'test' --vertical immobilien --location 900 | whcli analyze",
      "# Compare listings",
      "whcli compare 1019185101 1251831577 1856130626",
      "# Images",
      "whcli images 1019185101",
      "whcli images 1019185101 --dir ./photos --download",
      "# Other",
      "whcli tree                          # Root categories",
      "whcli tree 2691                     # Drill into Smartphones/Telefonie",
      "whcli locations                     # List Austrian states",
      "whcli view 12345678",
      "whcli seller abc123",
      "whcli auth                          # Check auth (sweet-cookie)",
      "whcli message 12345678 'Hallo, ist das noch verfügbar?'",
      "whcli chats                         # List all conversations",
      "whcli favorites list",
      "whcli history",
    ],
  };
  output(help, format);
}

async function main() {
  // Seed reference data (idempotent — skips if already populated)
  seedCategories();
  seedRegions();

  const args = process.argv.slice(2);
  const { command, positional, flags } = parseArgs(args);
  const format = getFormat(flags);

  switch (command) {
    case "search":
      await cmdSearch(positional, flags, format);
      break;
    case "tree":
      await cmdTree(positional, flags, format);
      break;
    case "locations":
      cmdLocations(format, flags);
      break;
    case "view":
      await cmdView(positional, flags, format);
      break;
    case "images":
      await cmdImages(positional, flags, format);
      break;
    case "analyze":
      await cmdAnalyze(positional, flags, format);
      break;
    case "compare":
      await cmdCompare(positional, flags, format);
      break;
    case "seller":
      await cmdSeller(positional, flags, format);
      break;
    case "auth":
      await cmdAuth(flags, format);
      break;
    case "message":
      await cmdMessage(positional, flags, format);
      break;
    case "chats":
      await cmdChats(positional, flags, format);
      break;
    case "favorites":
      await cmdFavorites(positional, flags, format);
      break;
    case "history":
      cmdHistory(format);
      break;
    case "wishlist":
      cmdWishlist(positional, flags, format);
      break;
    case "overview":
      await cmdOverview(positional, flags, format);
      break;
    case "help":
    case "--help":
    case "-h":
      cmdHelp(format);
      break;
    default:
      output({ error: `Unknown command: ${command}. Use 'whcli help' for usage.` }, format);
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
});
