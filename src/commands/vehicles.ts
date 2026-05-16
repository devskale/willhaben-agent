/**
 * Vehicle search command handler (car, moto, van, caravan).
 */

import { searchVehicles } from '../agents/search-vehicles.js';
import { resolveLocationInput } from '../agents/locations.js';
import { output, type OutputFormat } from './shared.js';

export async function cmdVehicleSearch(
  command: string,
  positional: string[],
  flags: Record<string, string | boolean>,
  format: OutputFormat,
) {
  const keyword = positional.join(' ');
  const priceTo = typeof flags['max-price'] === 'string' ? parseFloat(flags['max-price']) : undefined;
  const priceFrom = typeof flags['min-price'] === 'string' ? parseFloat(flags['min-price']) : undefined;
  const yearFrom = typeof flags['year-from'] === 'string' ? parseInt(flags['year-from'], 10) : undefined;
  const yearTo = typeof flags['year-to'] === 'string' ? parseInt(flags['year-to'], 10) : undefined;
  const mileageTo = typeof flags['max-km'] === 'string' ? parseInt(flags['max-km'], 10) : undefined;
  const fuel = typeof flags.fuel === 'string' ? flags.fuel : undefined;
  const transmission = typeof flags.transmission === 'string' ? flags.transmission : undefined;
  const category = typeof flags.type === 'string' ? flags.type : undefined;
  const isPrivate = flags.private === true;

  let areaIds: number[] | undefined;
  if (typeof flags.location === 'string') {
    const loc = resolveLocationInput(flags.location);
    areaIds = loc.areaIds;
    if (loc.resolved.length) {
      process.stderr.write(`  📍 ${loc.resolved.map(r => `${r.name} (${r.areaId})`).join(', ')}\n`);
    }
  }

  try {
    const result = await searchVehicles(command, {
      keyword: keyword || undefined,
      priceFrom, priceTo, yearFrom, yearTo, mileageTo,
      fuel, transmission, category, areaIds, isPrivate, rows: 30,
    });

    const sortBy = typeof flags.sort === 'string' ? flags.sort : undefined;
    let items = result.items;

    // Server ignores ISPRIVATE when keyword is set — client-side fallback
    if (isPrivate) items = items.filter(i => i.isPrivate);
    if (sortBy === 'price-asc') items.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    else if (sortBy === 'price-desc') items.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    else if (sortBy === 'newest') items.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));

    if (format === 'text') {
      const sv = result.subvertical;
      console.log(`\n🚗  ${sv.name}  —  ${result.totalFound.toLocaleString()} Treffer`);

      const filterParts: string[] = [];
      if (keyword) filterParts.push(`"${keyword}"`);
      for (const [k, v] of Object.entries(result.resolvedFilters)) filterParts.push(`${k}: ${v}`);
      if (priceTo) filterParts.push(`max €${priceTo}`);
      if (priceFrom) filterParts.push(`ab €${priceFrom}`);
      if (yearFrom) filterParts.push(`ab ${yearFrom}`);
      if (yearTo) filterParts.push(`bis ${yearTo}`);
      if (mileageTo) filterParts.push(`max ${mileageTo.toLocaleString()}km`);
      if (isPrivate) filterParts.push('Privat');
      if (areaIds?.length) filterParts.push(`Area: ${areaIds.join(',')}`);
      if (filterParts.length) console.log(`   Filter: ${filterParts.join(' | ')}`);
      console.log();

      if (items.length === 0) { console.log('   Keine Treffer gefunden.\n'); return; }

      for (const item of items) {
        const priv = item.isPrivate ? '👤' : '🏢';
        const pickerl = item.hasConditionReport ? '✅' : '  ';
        const loc = item.location ? `  📍 ${item.location}` : '';
        const img = item.imageUrl ? '  📷' : '';

        const details: string[] = [];
        if (item.yearModel) details.push(`${item.yearModel} EZ`);
        if (item.mileage) details.push(`${parseInt(item.mileage).toLocaleString()} km`);
        if (item.engineKw) {
          const ps = Math.round(parseInt(item.engineKw) * 1.36);
          details.push(`${ps} PS (${item.engineKw} kW)`);
        }
        const evItem = item as any;
        if (evItem.engineVolume) details.push(`${evItem.engineVolume} ccm`);
        if (item.fuel) details.push(item.fuel);
        if (item.transmission) details.push(item.transmission);
        if (item.vehicleType) details.push(item.vehicleType);

        console.log(`  ${pickerl} ${item.priceText.padEnd(12)} ${priv}  ${item.heading}`);
        console.log(`     ${details.join(' | ')}`);
        console.log(`     ${loc}${img}  https://www.willhaben.at/iad/object?adId=${item.id}`);
        console.log();
      }
      return;
    }

    output({ ...result, items }, format);
  } catch (e) {
    output({ error: e instanceof Error ? e.message : 'Vehicle search failed' }, format);
    process.exit(1);
  }
}
