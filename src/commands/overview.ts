/**
 * Immo overview command handler.
 */

import { getImmoOverview } from '../agents/search.js';
import { resolveLocationInput } from '../agents/locations.js';
import { buildImmoFilters, getChildAreas, fmtNum, fmtCur, fmtPpm2, strFlag, intFlag } from '../lib/cli-helpers.js';
import { output, type OutputFormat } from './shared.js';

export async function cmdOverview(
  positional: string[],
  flags: Record<string, string | boolean>,
  format: OutputFormat,
) {
  const locInput = strFlag(flags, 'location');
  let areaIds = locInput
    ? resolveLocationInput(locInput).resolved.map(r => ({ areaId: r.areaId, name: r.name }))
    : getChildAreas(900);

  const parentId = intFlag(flags, 'parent');
  if (parentId) areaIds = getChildAreas(parentId);

  const { filters: activeFilters } = buildImmoFilters(flags);

  try {
    const overview = await getImmoOverview(areaIds, undefined, 30, activeFilters);

    if (format === 'text') {
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
