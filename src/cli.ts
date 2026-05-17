#!/usr/bin/env node
/**
 * whcli — Willhaben.at CLI for agent automation.
 *
 * Thin dispatcher: parse args → auth gate → delegate to command handlers.
 * All business logic lives in src/agents/, all formatting in src/commands/.
 */

import { checkAuth } from './agents/auth.js';
import { seedCategories, seedRegions, seedVehicleCategories, seedFilterValues } from './agents/db.js';
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
// Filter schemas are fetched inline in cmdFilters() — no external imports needed
import * as fs from 'fs';
import * as path from 'path';

const VERSION = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'package.json'), 'utf-8')).version;

// ─── Auth Router ────────────────────────────────────────────────────────
const PUBLIC_COMMANDS = new Set([
  'search', 'car', 'moto', 'van', 'caravan', 'similar', 'similar-items',
  'tree', 'locations', 'view', 'images', 'analyze', 'compare', 'seller',
  'history', 'help', 'immo-filters', 'vehicle-filters',
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

  const { command, positional, flags, multiFlags } = parseArgs(args);
  const format = getFormat(flags);

  if (AUTH_COMMANDS.has(command)) {
    await requireAuth(command, format, flags);
  }

  switch (command) {
    case 'search':        return await cmdSearch(positional, flags, format);
    case 'car':
    case 'moto':
    case 'van':
    case 'caravan':       return await cmdVehicleSearch(command, positional, flags, format, multiFlags);
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
    case 'immo-filters':    return await cmdFilters('immobilien', positional, flags, format);
    case 'vehicle-filters': return await cmdFilters('vehicle', positional, flags, format);
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

async function cmdFilters(vertical: 'immobilien' | 'vehicle', positional: string[], flags: Record<string, string | boolean>, format: OutputFormat) {
  const typeName = typeof flags.type === 'string' ? flags.type.toLowerCase() : '';
  let searchId: number;
  let label: string;

  if (vertical === 'immobilien') {
    const typeMap: Record<string, number> = { alle: 90, mietwohnung: 131, eigentumswohnung: 101, haus: 102, miethaus: 132, grundstueck: 14, gewerbe: 15, neubau: 42 };
    searchId = typeMap[typeName] || 101;
    label = typeName || 'eigentumswohnung';
  } else {
    const typeMap: Record<string, number> = { auto: 2, moto: 4, van: 50, caravan: 52 };
    searchId = typeMap[typeName] || 2;
    label = typeName || 'auto';
  }

  const filters = await fetchFilterSchema(vertical, searchId);
  if (format === 'text') {
    console.log(`\n📐 Server-side filters: ${label} (searchId=${searchId})\n`);
    let lastGroup = '';
    for (const f of filters) {
      if (f.group !== lastGroup) { console.log(`  ${f.group}`); lastGroup = f.group; }
      const param = f.params.join(', ');
      const sel = f.selectionType === 'MULTI_SELECT' ? 'multi' : 'single';
      const vals = (f.values || []).slice(0, 8).join(', ');
      console.log(`    ${f.label.padEnd(20)} ${param.padEnd(38)} [${f.type}] ${sel}`);
      if (vals) console.log(`      → ${vals}${(f.values || []).length > 8 ? ' ...' : ''}`);
    }
    console.log();
    return;
  }
  output(filters, format);
}

interface FilterSchema { group: string; id: string; label: string; type: string; selectionType: string; params: string[]; values?: string[] }

async function fetchFilterSchema(vertical: 'immobilien' | 'vehicle', searchId: number): Promise<FilterSchema[]> {
  const vId = vertical === 'immobilien' ? 2 : 3;
  const { headers } = await getPublicHeaders();

  // Vehicles: fetch from SSR detailsuche page to get groupedPossibleValues with labels + codes
  if (vertical === 'vehicle') {
    const paths: Record<number, string> = { 2: 'auto', 4: 'motorrad', 50: 'nutzfahrzeug-pickup', 52: 'wohnwagen-wohnmobile' };
    const path = paths[searchId] || 'auto';
    const htmlResp = await fetch(`https://www.willhaben.at/iad/gebrauchtwagen/${path}/detailsuche`, { headers: { ...headers, Accept: 'text/html' } });
    if (htmlResp.ok) {
      const html = await htmlResp.text();
      const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
      if (match) {
        try {
          const d = JSON.parse(match[1]);
          const r = d.props?.pageProps?.initialSearchResult;
          if (r?.navigatorGroups) {
            const result: FilterSchema[] = [];
            for (const group of r.navigatorGroups) {
              for (const nav of group.navigatorList || []) {
                if (nav.id === 'searchId' || !nav.label) continue;
                const params = (nav.urlConstructionInformation?.urlParams || []).map((p: any) => p.urlParameterName);
                const gvals = nav.groupedPossibleValues || [];
                const values = gvals.flatMap((g: any) => (g.possibleValues || []).map((v: any) => {
                  const code = v.urlParamRepresentationForValue?.[0]?.value || v.id;
                  return `${v.label}=${code}`;
                }));
                // Seed discovered values into DB for --filter resolution
                const paramKey = params[0];
                if (values.length > 0 && paramKey) {
                  const rawVals = gvals.flatMap((g: any) => (g.possibleValues || []).map((v: any) => ({
                    label: v.label, code: v.urlParamRepresentationForValue?.[0]?.value || v.id,
                  })));
                  seedFilterValues(searchId, paramKey, rawVals);
                }
                result.push({
                  group: group.label, id: nav.id, label: nav.label, type: nav.navigatorType,
                  selectionType: nav.navigatorSelectionType, params, values,
                });
              }
            }
            return result;
          }
        } catch { /* fall through to JSON API */ }
      }
    }
  }

  // Fallback / Immobilien: try SSR page for values, then JSON API for schema only
  if (vertical === 'immobilien') {
    const immoPaths: Record<number, string> = { 90: 'immobilien', 131: 'mietwohnung-angebote', 101: 'eigentumswohnung/detailsuche', 102: 'haus-kaufen/detailsuche', 132: 'haus-mieten/detailsuche', 14: 'grundstueck/detailsuche', 15: 'gewerbeimmobilie-kaufen/detailsuche', 16: 'gewerbeimmobilie-mieten/detailsuche', 42: 'neubau/detailsuche', 35: 'sonstige-immobilien/detailsuche' };
    const immoPath = immoPaths[searchId] || 'immobilien';
    const prefix = searchId === 90 ? 'iad' : 'iad/immobilien';
    const htmlResp = await fetch(`https://www.willhaben.at/${prefix}/${immoPath}`, { headers: { ...headers, Accept: 'text/html' } });
    if (htmlResp.ok) {
      const html = await htmlResp.text();
      const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
      if (match) {
        try {
          const d = JSON.parse(match[1]);
          const r = d.props?.pageProps?.searchResult || d.props?.pageProps?.initialSearchResult;
          if (r?.navigatorGroups) {
            const result: FilterSchema[] = [];
            for (const group of r.navigatorGroups) {
              for (const nav of group.navigatorList || []) {
                if (nav.id === 'searchId' || !nav.label) continue;
                const params = (nav.urlConstructionInformation?.urlParams || []).map((p: any) => p.urlParameterName);
                const gvals = nav.groupedPossibleValues || [];
                const rawVals: Array<{ label: string; code: string }> = [];
                const values = gvals.flatMap((g: any) => (g.possibleValues || []).map((v: any) => {
                  const code = v.urlParamRepresentationForValue?.[0]?.value || v.id;
                  rawVals.push({ label: v.label, code });
                  return `${v.label}=${code}`;
                }));
                if (values.length > 0 && params[0]) seedFilterValues(searchId, params[0], rawVals);
                result.push({
                  group: group.label, id: nav.id, label: nav.label, type: nav.navigatorType,
                  selectionType: nav.navigatorSelectionType, params, values,
                });
              }
            }
            return result;
          }
        } catch { /* fall through */ }
      }
    }
  }

  // Final fallback: JSON API (no values, just param names)
  const resp = await fetch(
    `https://www.willhaben.at/webapi/ad-search/search/atz/${vId}/${searchId}?rows=1`,
    { headers },
  );
  if (!resp.ok) return [];
  const data = await resp.json() as {
    navigatorGroups?: Array<{
      label: string;
      navigatorList?: Array<{
        id: string; label: string; navigatorType: string; navigatorSelectionType: string;
        urlConstructionInformation?: { urlParams?: Array<{ urlParameterName: string }> };
      }>;
    }>;
  };
  const result: FilterSchema[] = [];
  for (const group of data.navigatorGroups || []) {
    for (const nav of group.navigatorList || []) {
      if (nav.id === 'searchId' || !nav.label) continue;
      result.push({
        group: group.label, id: nav.id, label: nav.label, type: nav.navigatorType,
        selectionType: nav.navigatorSelectionType,
        params: (nav.urlConstructionInformation?.urlParams || []).map(p => p.urlParameterName),
      });
    }
  }
  return result;
}

import { getPublicHeaders } from './lib/http.js';

main().catch(e => {
  console.error(JSON.stringify({ error: e.message }));
  process.exit(1);
});
