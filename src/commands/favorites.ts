/**
 * Favorites command handler — all subcommands.
 */

import { getStarredItems } from '../agents/db.js';
import { downloadMerkliste, itemsToCSV, summarizeMerkliste, listFolders, createFolder, saveAdToFolder, removeAd } from '../agents/merkliste.js';
import { output, type OutputFormat } from './shared.js';

export async function cmdFavorites(
  positional: string[],
  flags: Record<string, string | boolean>,
  format: OutputFormat,
) {
  const subcommand = positional[0] || 'list';

  if (subcommand === 'list') {
    output(getStarredItems(), format);
    return;
  }

  if (subcommand === 'download') {
    const items = await downloadMerkliste();
    if (flags.csv === true || typeof flags.csv === 'string') {
      console.log(itemsToCSV(items));
    } else {
      output(items, format);
    }
    return;
  }

  if (subcommand === 'summary') {
    const items = await downloadMerkliste();
    const summary = summarizeMerkliste(items);

    if (format === 'text') {
      console.log(`\n📦  Merkliste Zusammenfassung\n`);
      console.log(`   Teile:         ${summary.count}`);
      console.log(`   Gesamtwert:    €${summary.totalValue.toFixed(2)}`);
      console.log(`   Durchschnitt:  €${summary.avgPrice.toFixed(2)}`);
      console.log(`   Spanne:        €${summary.minPrice.toFixed(2)} – €${summary.maxPrice.toFixed(2)}`);
      console.log();
      console.log('   Top 10 (teuerste):');
      summary.topItems.forEach((it, i) => {
        console.log(`   ${(i + 1 + '.').padEnd(4)} €${it.price.toFixed(2).padStart(8)}  ${it.title.substring(0, 55)}`);
      });
      if (summary.bottomItems.length) {
        console.log();
        console.log('   Günstigste:');
        summary.bottomItems.forEach((it, i) => {
          console.log(`   ${(i + 1 + '.').padEnd(4)} €${it.price.toFixed(2).padStart(8)}  ${it.title.substring(0, 55)}`);
        });
      }
      console.log();
      return;
    }

    output(summary, format);
    return;
  }

  if (subcommand === 'folders') {
    try {
      const folders = await listFolders();
      if (format === 'text') {
        console.log('\n📁  Merkliste Ordner\n');
        if (folders.length === 0) { console.log('   Keine Ordner gefunden.\n'); return; }
        for (const f of folders) {
          const count = f.itemCount !== undefined ? ` (${f.itemCount} Anzeigen)` : '';
          const desc = f.description ? ` — ${f.description}` : '';
          console.log(`   ${String(f.id).padEnd(10)} ${f.name}${count}${desc}`);
        }
        console.log();
        return;
      }
      output(folders, format);
    } catch (e) {
      output({ error: e instanceof Error ? e.message : 'Failed to list folders' }, format);
      process.exit(1);
    }
    return;
  }

  if (subcommand === 'create-folder') {
    const name = positional[1];
    if (!name) {
      output({ error: 'Usage: whcli favorites create-folder <name>' }, format);
      process.exit(1);
    }
    const desc = typeof flags.description === 'string' ? flags.description : undefined;
    try {
      const folder = await createFolder(name, desc);
      output({ success: true, folder }, format);
    } catch (e) {
      output({ error: e instanceof Error ? e.message : 'Failed to create folder' }, format);
      process.exit(1);
    }
    return;
  }

  if (subcommand === 'save') {
    const adId = positional[1];
    if (!adId || !/^\d+$/.test(adId)) {
      output({ error: 'Usage: whcli favorites save <adId> [--folder <name|id>]' }, format);
      process.exit(1);
    }
    try {
      const folderArg = typeof flags.folder === 'string' ? flags.folder : undefined;
      let folderId: number;
      let folderName: string | undefined;

      if (folderArg) {
        if (/^\d+$/.test(folderArg)) {
          folderId = parseInt(folderArg, 10);
          folderName = folderArg;
        } else {
          const folders = await listFolders();
          const match = folders.find(f => f.name.toLowerCase() === folderArg.toLowerCase());
          if (!match) {
            output({ error: `Folder "${folderArg}" not found. Available: ${folders.map(f => f.name).join(', ')}` }, format);
            process.exit(1);
          }
          folderId = match.id;
          folderName = match.name;
        }
      } else {
        const folders = await listFolders();
        if (folders.length === 0) {
          output({ error: 'No folders found. Create one first: whcli favorites create-folder <name>' }, format);
          process.exit(1);
        }
        folderId = folders[0].id;
        folderName = folders[0].name;
      }

      const result = await saveAdToFolder(adId, folderId);
      result.folderName = folderName;

      if (format === 'text') {
        console.log(`\n✅  Anzeige #${adId} gespeichert in Ordner "${folderName}" (ID: ${folderId})\n`);
        return;
      }
      output({ success: true, ...result }, format);
    } catch (e) {
      output({ error: e instanceof Error ? e.message : 'Failed to save ad' }, format);
      process.exit(1);
    }
    return;
  }

  if (subcommand === 'remove') {
    const adId = positional[1];
    if (!adId || !/^\d+$/.test(adId)) {
      output({ error: 'Usage: whcli favorites remove <adId>' }, format);
      process.exit(1);
    }
    try {
      const result = await removeAd(adId);
      if (format === 'text') {
        console.log(result.removed
          ? `\n🗑️  Anzeige #${adId} von Merkliste entfernt.\n`
          : `\n⚠️  Konnte Anzeige #${adId} nicht entfernen.\n`);
        return;
      }
      output(result, format);
    } catch (e) {
      output({ error: e instanceof Error ? e.message : 'Failed to remove ad' }, format);
      process.exit(1);
    }
    return;
  }

  output({ error: `Unknown favorites subcommand: ${subcommand}. Use: list|download|summary|folders|create-folder|save|remove` }, format);
  process.exit(1);
}
