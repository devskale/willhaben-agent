/**
 * View and Images command handlers.
 */

import { getListingDetails, getListingImages } from '../agents/search.js';
import { output, type OutputFormat } from './shared.js';
import * as fs from 'fs';
import * as path from 'path';

export async function cmdView(
  positional: string[],
  flags: Record<string, string | boolean>,
  format: OutputFormat,
) {
  const adId = positional[0];
  if (!adId) {
    output({ error: 'Missing listing ID' }, format);
    process.exit(1);
  }

  if (flags.images === true || flags['all-images'] === true) {
    try {
      const result = await getListingImages(adId);
      if (flags['all-images'] !== true && result.images.length > 1) {
        result.images = [result.images[0]];
        result.imageCount = 1;
      }
      output(result, format);
      return;
    } catch (e) {
      output({ error: e instanceof Error ? e.message : 'Failed to fetch images' }, format);
      process.exit(1);
    }
  }

  try {
    const detail = await getListingDetails(adId);
    output(detail, format);
  } catch (e) {
    output({ error: e instanceof Error ? e.message : 'Failed to fetch listing' }, format);
    process.exit(1);
  }
}

export async function cmdImages(
  positional: string[],
  flags: Record<string, string | boolean>,
  format: OutputFormat,
) {
  const adId = positional[0];
  if (!adId) {
    output({ error: 'Missing listing ID. Usage: whcli images <adId> [--dir <path>] [--open]' }, format);
    process.exit(1);
  }

  try {
    const result = await getListingImages(adId);
    const images = result.images || [];

    if (flags.dir || flags.download) {
      const outDir = typeof flags.dir === 'string' ? flags.dir : `./wh_images_${adId}`;
      fs.mkdirSync(outDir, { recursive: true });
      const downloaded: string[] = [];
      for (let idx = 0; idx < images.length; idx++) {
        const img = images[idx];
        const imgUrl = typeof img === 'string' ? img : (img as any).url || String(img);
        const ext = imgUrl.includes('_hoved') ? '_main.jpg' : '.jpg';
        const filename = `${adId}_${idx.toString().padStart(3, '0')}${ext}`;
        const filepath = path.join(outDir, filename);
        if (!downloaded.some(d => d === filepath)) {
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

    output({ adId, imageCount: images.length, images, preview: images[0] || null }, format);
  } catch (e) {
    output({ error: e instanceof Error ? e.message : 'Failed to fetch images' }, format);
    process.exit(1);
  }
}
