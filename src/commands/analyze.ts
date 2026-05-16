/**
 * Analyze and Compare command handlers.
 */

import { searchItems } from '../agents/search.js';
import { getListingDetails } from '../agents/search.js';
import { resolveLocationInput } from '../agents/locations.js';
import { buildImmoFilters, buildMarktplatzFilters } from '../lib/cli-helpers.js';
import { filterByType, filterBySize, filterByRooms, filterByPrice, analyzeListings, compareListings } from '../lib/analysis.js';
import { output, type OutputFormat } from './shared.js';

export async function cmdAnalyze(
  positional: string[],
  flags: Record<string, string | boolean>,
  format: OutputFormat,
) {
  let items;
  if (positional.length > 0 && positional[0].startsWith('{')) {
    try {
      const data = JSON.parse(positional.join(' '));
      items = data.items || data;
    } catch {
      output({ error: 'Invalid JSON input' }, format);
      process.exit(1);
    }
  } else if (positional.join(' ').trim()) {
    const query = positional.join(' ');
    const page = typeof flags.page === 'string' ? parseInt(flags.page, 10) : 1;
    const maxPages = typeof flags.pages === 'string' ? parseInt(flags.pages, 10) : 1;
    const category = typeof flags.category === 'string' ? flags.category : undefined;
    const maxPrice = typeof flags['max-price'] === 'string' ? parseFloat(flags['max-price']) : undefined;
    const minPrice = typeof flags['min-price'] === 'string' ? parseFloat(flags['min-price']) : undefined;
    const propertyType = typeof flags.type === 'string' ? flags.type : undefined;
    const minSize = typeof flags['min-size'] === 'string' ? parseFloat(flags['min-size']) : undefined;
    const maxSize = typeof flags['max-size'] === 'string' ? parseFloat(flags['max-size']) : undefined;
    const rooms = typeof flags.rooms === 'string' ? parseInt(flags.rooms, 10) : undefined;
    const sortBy = typeof flags.sort === 'string' ? flags.sort : undefined;
    let areaIds: number[] | undefined;
    if (typeof flags.location === 'string') areaIds = resolveLocationInput(flags.location).areaIds;
    const vertical = typeof flags.vertical === 'string' ? flags.vertical : undefined;

    const { filters: immoFilters, searchId: immoSearchId, isImmo } = buildImmoFilters(flags);
    const marktplatzFilters = buildMarktplatzFilters(flags);
    const result = await searchItems(query, category, page, areaIds, vertical, immoFilters, immoSearchId, marktplatzFilters, maxPages);
    items = result.items;

    if (!isImmo) {
      items = filterByPrice(items, minPrice, maxPrice);
      if (propertyType) items = filterByType(items, propertyType);
      items = filterBySize(items, minSize, maxSize);
      items = filterByRooms(items, rooms);
    }
    if (sortBy === 'price-asc') items.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    else if (sortBy === 'price-desc') items.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
  } else {
    output({ error: "Usage: whcli analyze <query> [flags] OR pipe JSON from 'whcli search'" }, format);
    process.exit(1);
  }

  output(analyzeListings(items), format);
}

export async function cmdCompare(
  positional: string[],
  flags: Record<string, string | boolean>,
  format: OutputFormat,
) {
  const adIds = positional.filter(id => /^\d+$/.test(id));
  if (adIds.length < 2) {
    output({ error: 'Need at least 2 listing IDs. Usage: whcli compare <id1> <id2> [id3 ...]' }, format);
    process.exit(1);
  }
  try {
    const listings = [];
    for (const id of adIds) {
      const detail = await getListingDetails(id);
      listings.push(detail as any);
    }
    output(compareListings(listings as any[]), format);
  } catch (e) {
    output({ error: e instanceof Error ? e.message : 'Comparison failed' }, format);
    process.exit(1);
  }
}
