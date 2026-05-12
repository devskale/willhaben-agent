/**
 * Image utility — download and manage images from URLs.
 * Works with any public image URL, not just willhaben.
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface ImageDownload {
  url: string;
  filename: string;
  path: string;       // absolute file path
  size: number;        // bytes
  width?: number;
  height?: number;
}

export interface ImageDownloaderOptions {
  /** Output directory (default: ./medien) */
  outDir?: string;
  /** Filename prefix (default: "img") */
  prefix?: string;
  /** Referer header for hotlink protection */
  referer?: string;
  /** Whether to pad index numbers (default: true) */
  padIndex?: boolean;
}

const DEFAULT_OPTIONS: Required<ImageDownloaderOptions> = {
  outDir: "./medien",
  prefix: "img",
  referer: "",
  padIndex: true,
};

/**
 * Download images from URLs sequentially.
 * Returns metadata for each downloaded image.
 */
export async function downloadImages(
  urls: string[],
  options: ImageDownloaderOptions = {}
): Promise<ImageDownload[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Ensure output directory exists
  if (!existsSync(opts.outDir)) {
    mkdirSync(opts.outDir, { recursive: true });
  }

  const results: ImageDownload[] = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const idx = opts.padIndex ? String(i + 1).padStart(2, "0") : String(i + 1);
    
    // Extract extension from URL or default to .jpg
    const ext = url.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i)?.[1] || "jpg";
    const filename = `${opts.prefix}_${idx}.${ext}`;
    const filePath = join(opts.outDir, filename);

    try {
      const headers: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      };
      if (opts.referer) {
        headers["Referer"] = opts.referer;
      }

      const resp = await fetch(url, { headers });
      
      if (!resp.ok) {
        results.push({ url, filename, path: filePath, size: 0 });
        continue;
      }

      const buffer = Buffer.from(await resp.arrayBuffer());
      writeFileSync(filePath, buffer);

      results.push({
        url,
        filename,
        path: filePath,
        size: buffer.length,
      });
    } catch (e) {
      results.push({ url, filename, path: filePath, size: 0 });
    }
  }

  return results;
}

/**
 * Download a single image.
 */
export async function downloadImage(
  url: string,
  filename?: string,
  options: ImageDownloaderOptions = {}
): Promise<ImageDownload | null> {
  const results = await downloadImages([url], { ...options, prefix: filename || opts.prefix });
  return results[0]?.size > 0 ? results[0] : null;
}

/**
 * Format image download results as text table.
 */
export function formatImageTable(downloads: ImageDownload[]): string {
  if (downloads.length === 0) return "   Keine Bilder heruntergeladen.\n";

  const lines: string[] = [];
  const totalSize = downloads.reduce((sum, d) => sum + d.size, 0);
  
  lines.push(`📷 ${downloads.length} Bilder  (${formatBytes(totalSize)})\n`);
  lines.push("┌──────┬──────────────────────────────────┬────────┐");
  lines.push("│  #   │ Dateiname                           │  Größe  │");
  lines.push("├──────┼──────────────────────────────────┼────────┤");

  for (let i = 0; i < downloads.length; i++) {
    const d = downloads[i];
    const idx = String(i + 1).padStart(2);
    const name = d.filename.substring(0, 34).padEnd(34);
    const size = d.size > 0 ? formatBytes(d.size).padEnd(8) : "  fehlg.";
    lines.push(`│ ${idx} │ ${name} │ ${size} │`);
  }

  lines.push("└──────┴──────────────────────────────────┴────────┘\n");
  return lines.join("\n");
}

/** Format bytes to human-readable string */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
