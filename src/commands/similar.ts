/**
 * Similar listings command handlers (seller-based, item-based, product-based).
 */

import { getSimilarListings } from '../agents/similar.js';
import { getItemSimilarListings } from '../agents/similar-item.js';
import { findSimilarProducts } from '../agents/similar-product.js';
import { output, type OutputFormat } from './shared.js';

export async function cmdSimilar(
  positional: string[],
  flags: Record<string, string | boolean>,
  format: OutputFormat,
) {
  const input = positional[0];
  if (!input) {
    output({ error: "Usage: whcli similar <adId | 'product name'> [--item]\nExamples:\n  whcli similar 2097858592       # seller-based (same seller)\n  whcli similar 'pixel 4a'       # similar products\n  whcli similar 2097858592 --item # content-based (same brand/price)" }, format);
    process.exit(1);
  }

  const rows = typeof flags.rows === 'string' ? parseInt(flags.rows, 10) : 15;
  const isAdId = /^\d+$/.test(input);

  if (isAdId) {
    if (flags.item) {
      await cmdSimilarItems(positional, flags, format);
    } else {
      await cmdSellerSimilar(input, rows, format);
    }
  } else {
    await cmdProductSimilar(input, rows, flags, format);
  }
}

async function cmdSellerSimilar(adId: string, rows: number, format: OutputFormat) {
  try {
    const result = await getSimilarListings(adId, rows);

    if (format === 'text') {
      console.log(`\n🔗  ${result.heading} für ${adId}  —  ${result.totalFound} Treffer (seller-based)\n`);
      console.log(`   Original: https://www.willhaben.at/iad/object?adId=${adId}\n`);
      if (result.items.length === 0) { console.log('   Keine ähnlichen Anzeigen gefunden.\n'); return; }
      for (let i = 0; i < result.items.length; i++) {
        const item = result.items[i];
        const img = item.imageUrl ? '  📷' : '';
        console.log(`  ${i + 1}. ${item.priceText.padEnd(12)} ${item.title}`);
        console.log(`     📍 ${item.location || '?'}${img}`);
        console.log(`     ${item.url}`);
        console.log();
      }
      return;
    }
    output(result, format);
  } catch (e) {
    output({ error: e instanceof Error ? e.message : 'Failed to get similar listings' }, format);
    process.exit(1);
  }
}

async function cmdProductSimilar(query: string, rows: number, flags: Record<string, string | boolean>, format: OutputFormat) {
  try {
    const result = await findSimilarProducts(query, rows);

    if (format === 'text') {
      console.log(`\n🔍  Similar to "${query}"\n`);
      console.log(`   Found ${result.referenceCount} references, median price: ${result.medianPrice ? `€${result.medianPrice}` : 'unknown'}\n`);
      if (result.items.length === 0) { console.log('   No similar products found.\n'); return; }
      for (let i = 0; i < result.items.length; i++) {
        const item = result.items[i];
        const diff = item.priceDiff !== null
          ? (item.priceDiff > 0 ? ` (+€${item.priceDiff})` : ` (-€${Math.abs(item.priceDiff)})`)
          : '';
        const priv = item.reason.includes('private') ? '👤' : '  ';
        console.log(`  ${i + 1}. ${`🎯${item.score}`.padEnd(6)} ${item.priceText.padEnd(12)} ${item.title}${diff}`);
        console.log(`     ${priv} 📍 ${item.location || '?'}  ${item.reason}`);
        console.log(`     ${item.url}`);
        console.log();
      }
      return;
    }
    output(result, format);
  } catch (e) {
    output({ error: e instanceof Error ? e.message : 'Failed to find similar products' }, format);
    process.exit(1);
  }
}

export async function cmdSimilarItems(
  positional: string[],
  flags: Record<string, string | boolean>,
  format: OutputFormat,
) {
  const adId = positional[0];
  if (!adId) {
    output({ error: 'Missing ad ID. Usage: whcli similar <adId> --item' }, format);
    process.exit(1);
  }

  const rows = typeof flags.rows === 'string' ? parseInt(flags.rows, 10) : 10;

  try {
    const result = await getItemSimilarListings(adId, rows);

    if (format === 'text') {
      console.log(`\n🔍  Item-based similar listings für #${adId}\n`);
      console.log(`   Source: ${result.sourceTitle} — ${result.sourcePrice !== null ? `€${result.sourcePrice}` : 'no price'}`);
      console.log(`   Strategy: ${result.searchStrategy}\n`);
      if (result.items.length === 0) { console.log('   Keine ähnlichen Anzeigen gefunden.\n'); return; }
      for (let i = 0; i < result.items.length; i++) {
        const item = result.items[i];
        const diff = item.priceDiff !== null ? (item.priceDiff > 0 ? ` (+€${item.priceDiff})` : ` (-€${Math.abs(item.priceDiff)})`) : '';
        const img = item.imageUrl ? '  📷' : '';
        console.log(`  ${i + 1}. ${`🎯${item.score}`.padEnd(6)} ${item.priceText.padEnd(12)} ${item.title}${diff}`);
        console.log(`     📍 ${item.location || '?'}${img}`);
        console.log(`     ${item.url}`);
        console.log();
      }
      return;
    }
    output(result, format);
  } catch (e) {
    output({ error: e instanceof Error ? e.message : 'Failed to get item-similar listings' }, format);
    process.exit(1);
  }
}
