/**
 * Search command handler.
 */

import { searchItems, getListingDetails } from '../agents/search.js';
import { resolveLocationInput } from '../agents/locations.js';
import { buildImmoFilters, buildMarktplatzFilters, strFlag } from '../lib/cli-helpers.js';
import { addSearchHistory } from '../agents/db.js';
import { filterByType, filterBySize, filterByRooms, filterByKeyword, excludeByKeyword } from '../lib/analysis.js';
import { output, type OutputFormat } from './shared.js';

export async function cmdSearch(
  positional: string[],
  flags: Record<string, string | boolean>,
  format: OutputFormat,
) {
  const query = positional.join(' ');
  if (!query) {
    output({ error: 'Missing search query' }, format);
    process.exit(1);
  }

  const page = typeof flags.page === 'string' ? parseInt(flags.page, 10) : 1;
  const maxPages = typeof flags.pages === 'string' ? parseInt(flags.pages, 10) : 1;
  const category = typeof flags.category === 'string' ? flags.category : undefined;
  const sortBy = typeof flags.sort === 'string' ? flags.sort : undefined;
  const privateOnly = flags.private === true;
  const maxPrice = typeof flags['max-price'] === 'string' ? parseFloat(flags['max-price']) : undefined;
  const minPrice = typeof flags['min-price'] === 'string' ? parseFloat(flags['min-price']) : undefined;
  const propertyType = typeof flags.type === 'string' ? flags.type : undefined;
  const minSize = typeof flags['min-size'] === 'string' ? parseFloat(flags['min-size']) : undefined;
  const maxSize = typeof flags['max-size'] === 'string' ? parseFloat(flags['max-size']) : undefined;
  const rooms = typeof flags.rooms === 'string' ? parseInt(flags.rooms, 10) : undefined;
  const minRooms = typeof flags['min-rooms'] === 'string' ? parseInt(flags['min-rooms'], 10) : undefined;

  let areaIds: number[] | undefined;
  if (typeof flags.location === 'string') {
    const loc = resolveLocationInput(flags.location);
    areaIds = loc.areaIds;
    if (loc.resolved.length) {
      process.stderr.write(`  📍 ${loc.resolved.map(r => `${r.name} (${r.areaId})`).join(', ')}\n`);
    }
  }

  const vertical = typeof flags.vertical === 'string' ? flags.vertical : undefined;
  try {
    const { filters: immoFilters, searchId: immoSearchId, isImmo } = buildImmoFilters(flags);
    const marktplatzFilters = buildMarktplatzFilters(flags);
    const result = await searchItems(query, category, page, areaIds, vertical, immoFilters, immoSearchId, marktplatzFilters, maxPages);

    let items = result.items;

    if (!isImmo) {
      if (maxPrice !== undefined && !isNaN(maxPrice)) {
        items = items.filter(i => i.price !== null && i.price <= maxPrice);
      }
      if (minPrice !== undefined && !isNaN(minPrice)) {
        items = items.filter(i => i.price !== null && i.price >= minPrice);
      }
      if (propertyType) items = filterByType(items, propertyType);
      items = filterBySize(items, minSize, maxSize);
      items = filterByRooms(items, rooms, minRooms);
    }

    const keywords = strFlag(flags, 'keyword');
    if (keywords) items = filterByKeyword(items, keywords.split(',').map(s => s.trim()));
    const excludes = strFlag(flags, 'exclude');
    if (excludes) items = excludeByKeyword(items, excludes.split(',').map(s => s.trim()));

    if (sortBy === 'price-asc') {
      items.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    } else if (sortBy === 'price-desc') {
      items.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    } else if (sortBy === 'newest') {
      items.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
    }

    if (privateOnly && items.length > 0) {
      const hasApiData = items.some(i => i.isPrivate !== undefined);
      if (hasApiData) {
        items = items.filter(i => i.isPrivate === true);
      } else {
        const privateItems = [];
        for (const item of items.slice(0, 20)) {
          try {
            const detail = await getListingDetails(item.id);
            const attrs = detail.attributes || {};
            const isPrivate = attrs.ISPRIVATE?.[0] === '1' || attrs.DEALER?.[0] === '0';
            if (isPrivate) privateItems.push({ ...item, _isPrivate: true });
          } catch { /* skip */ }
        }
        items = privateItems;
      }
    }

    try {
      const prices = items.map(i => i.price).filter((p): p is number => p !== null);
      addSearchHistory(query, result.totalFound, category,
        prices.length > 0 ? Math.min(...prices) : undefined,
        prices.length > 0 ? Math.max(...prices) : undefined,
        areaIds?.[0]);
    } catch { /* ignore */ }

    if (format === 'text') {
      printSearchTable(query, result.totalFound, items, result.categories);
      return;
    }

    output({ ...result, items }, format);
  } catch (e) {
    output({ error: e instanceof Error ? e.message : 'Search failed' }, format);
    process.exit(1);
  }
}

function printSearchTable(query: string, totalFound: number, items: any[], categories: any[]) {
  console.log(`\n🔍  "${query}"  —  ${totalFound.toLocaleString()} Treffer${items.length < totalFound ? ` (zeige ${items.length})` : ''}\n`);

  if (categories.length > 0) {
    console.log('📂 Kategorien:');
    for (const c of categories.slice(0, 5)) {
      console.log(`   ${c.id.toString().padStart(8)}   ${(c.count || 0).toLocaleString().padStart(8)}x   ${c.name}`);
    }
    console.log();
  }

  if (items.length === 0) {
    console.log('   Keine Treffer gefunden.\n');
    return;
  }

  for (const item of items) {
    const priv = item.isPrivate ? '👤' : '🏢';
    const price = item.priceText || '?';
    const oldPrice = item.oldPriceText ? ` ~~${item.oldPriceText}~~` : '';
    const title = (item.title || '').substring(0, 55);
    const loc = (item.location || '?').substring(0, 30);
    const size = item.estateSize ? `${item.estateSize}m²` : '';
    const rooms = item.rooms ? `${item.rooms}Zi` : '';
    const ppsm = item.pricePerSqm ? `€${item.pricePerSqm}/m²` : '';
    const immo = [size, rooms, ppsm].filter(Boolean).join(' ');
    const immoPad = immo ? `  ${immo}` : '';
    console.log(`  ${priv} ${price.padEnd(10)}${oldPrice.padEnd(14)}  ${title.padEnd(55)}${immoPad}  ${loc}`);
  }
  console.log();
}
