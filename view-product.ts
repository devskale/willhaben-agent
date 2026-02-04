#!/usr/bin/env node

import { getListingDetails } from "./src/agents/search.js";
import { ListingDetail } from "../types.js";
import { getConfig, ASCII_CHAR_SETS } from "./src/agents/config.js";

// ANSI escape code for clickable URL
function clickableUrl(url: string, label?: string): string {
  const text = label || url;
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}

// Simple grayscale ASCII conversion
async function imageToAscii(
  imageUrl: string,
  maxWidth: number,
  asciiChars: string
): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();

    // Write to temp file for processing
    const { writeFile, unlink } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const tempPath = join("/tmp", "img-" + Date.now() + ".jpg");
    await writeFile(tempPath, Buffer.from(buffer));

    try {
      const sharp = (await import("sharp")).default;

      // Get image dimensions
      const metadata = await sharp(tempPath).metadata();
      const origWidth = metadata.width || maxWidth;
      const origHeight = metadata.height || maxWidth;

      // Calculate height maintaining aspect ratio (characters are ~2x tall)
      const aspectRatio = origHeight / origWidth;
      const targetWidth = maxWidth;
      const targetHeight = Math.floor(targetWidth * aspectRatio * 0.5);

      // Resize image and convert to raw RGB
      const resizedBuffer = await sharp(tempPath)
        .resize(targetWidth, targetHeight, { fit: "fill" })
        .raw()
        .toBuffer();

      await unlink(tempPath).catch(() => {});

      // Convert to grayscale ASCII using config chars
      let ascii = "";
      const chars = asciiChars;

      for (let y = 0; y < targetHeight; y++) {
        let line = "";
        for (let x = 0; x < targetWidth; x++) {
          const idx = (y * targetWidth + x) * 3;
          if (idx >= resizedBuffer.length) {
            line += " ";
            continue;
          }
          const r = resizedBuffer[idx];
          const g = resizedBuffer[idx + 1];
          const b = resizedBuffer[idx + 2];
          const gray = Math.floor((r + g + b) / 3);
          const charIndex = Math.floor((gray / 255) * (chars.length - 1));
          line += chars[charIndex];
        }
        ascii += line + "\n";
      }

      return ascii;
    } catch {
      await unlink(tempPath).catch(() => {});
      return simpleAsciiFromUrl(imageUrl, maxWidth);
    }
  } catch (error) {
    console.error("ASCII conversion failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

// Fallback: Fetch and do simple conversion
async function simpleAsciiFromUrl(imageUrl: string, width: number): Promise<string | null> {
  try {
    const innerWidth = width - 4;
    const lines = [
      " ".repeat(innerWidth),
      " ".repeat(Math.floor((innerWidth - 30) / 2)) + "▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄" + " ".repeat(Math.ceil((innerWidth - 30) / 2)),
      " ".repeat(Math.floor((innerWidth - 30) / 2)) + "██████████████████████████████" + " ".repeat(Math.ceil((innerWidth - 30) / 2)),
      " ".repeat(Math.floor((innerWidth - 28) / 2)) + "████████████████████████████",
      " ".repeat(innerWidth),
      " ".repeat(Math.floor((innerWidth - 20) / 2)) + "[ 📷 IMAGE PREVIEW ]" + " ".repeat(Math.ceil((innerWidth - 20) / 2)),
      " ".repeat(innerWidth),
      " ".repeat(Math.floor((innerWidth - 30) / 2)) + "██████████████████████████████" + " ".repeat(Math.ceil((innerWidth - 30) / 2)),
      " ".repeat(Math.floor((innerWidth - 30) / 2)) + "▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀" + " ".repeat(Math.ceil((innerWidth - 30) / 2)),
      " ".repeat(innerWidth),
    ];
    return lines.join("\n");
  } catch {
    return null;
  }
}

// Render product detail view to console
function renderProductDetail(listing: ListingDetail, asciiArt: string | null = null, width: number = 100): void {
  const hasImages = (listing.images && listing.images.length > 0) || !!listing.imageUrl;
  const imageUrl = listing.images?.[0] || listing.imageUrl || listing.url;
  const innerWidth = width - 4;

  console.log("");
  console.log("\x1b[36m┌" + "─".repeat(width - 2) + "┐\x1b[0m");

  // Header
  const title = listing.title?.substring(0, innerWidth - 12) || "Unknown Product";
  console.log("\x1b[36m│\x1b[0m " + (hasImages ? "\x1b[32;1m📷 IMG  \x1b[0m" : "\x1b[31mNO IMG  \x1b[0m") + title.padEnd(innerWidth - 10 - title.length) + "\x1b[36m│\x1b[0m");
  console.log("\x1b[36m├" + "─".repeat(width - 2) + "┤\x1b[0m");

  // Price and ID
  console.log("\x1b[36m│\x1b[0m \x1b[33;1m💰\x1b[0m " + (listing.priceText || listing.priceForDisplay || "N/A"));
  console.log("\x1b[36m│\x1b[0m \x1b[33;1m🏷️ \x1b[0m ID: " + listing.id);
  console.log("\x1b[36m├" + "─".repeat(width - 2) + "┤\x1b[0m");

  // ASCII Art Image Preview
  // Bernstein/Amber color: \x1b[38;5;214m
  console.log("\x1b[36m│\x1b[0m \x1b[38;5;214m📷 Image Preview:\x1b[0m");
  console.log("\x1b[36m│\x1b[0m");

  if (asciiArt) {
    // Show actual ASCII art with bernstein/amber color
    const lines = asciiArt.split("\n");
    lines.forEach((line) => {
      if (line.trim()) {
        console.log("\x1b[38;5;214m│ " + line.substring(0, innerWidth - 2) + "\x1b[0m");
      } else {
        console.log("\x1b[36m│\x1b[0m");
      }
    });
  } else {
    // Show placeholder
    const phWidth = Math.min(30, innerWidth - 4);
    const phPad = Math.floor((innerWidth - 4 - phWidth) / 2);
    console.log("\x1b[36m│\x1b[0m" + " ".repeat(phPad + 2) + "\x1b[38;5;214m┌" + "─".repeat(phWidth) + "┐\x1b[0m");
    console.log("\x1b[36m│\x1b[0m" + " ".repeat(phPad + 2) + "\x1b[38;5;214m│\x1b[0m" + " ".repeat(phWidth) + "\x1b[38;5;214m│\x1b[0m");
    console.log("\x1b[36m│\x1b[0m" + " ".repeat(phPad + 2) + "\x1b[38;5;214m│\x1b[0m \x1b[33;1m[ 📷 IMAGE PREVIEW ]\x1b[0m \x1b[38;5;214m│\x1b[0m");
    console.log("\x1b[36m│\x1b[0m" + " ".repeat(phPad + 2) + "\x1b[38;5;214m│\x1b[0m" + " ".repeat(phWidth) + "\x1b[38;5;214m│\x1b[0m");
    console.log("\x1b[36m│\x1b[0m" + " ".repeat(phPad + 2) + "\x1b[38;5;214m└" + "─".repeat(phWidth) + "┘\x1b[0m");
  }
  console.log("\x1b[36m│\x1b[0m");
  console.log("\x1b[36m├" + "─".repeat(width - 2) + "┤\x1b[0m");

  // Clickable URL
  console.log("\x1b[36m│\x1b[0m \x1b[34;1m🔗 Image URL:\x1b[0m");
  console.log("\x1b[36m│\x1b[0m   " + clickableUrl(imageUrl, imageUrl.substring(0, innerWidth - 6)));
  console.log("\x1b[36m│\x1b[0m   \x1b[90m(Ctrl+Click or copy URL to view image)\x1b[0m");
  console.log("\x1b[36m├" + "─".repeat(width - 2) + "┤\x1b[0m");

  // Description
  const desc = listing.fullDescription || listing.description || "No description";
  const cleanDesc = desc.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  console.log("\x1b[36m│\x1b[0m \x1b[33;1m📝 Description:\x1b[0m");
  console.log("\x1b[36m│\x1b[0m   " + cleanDesc.substring(0, innerWidth - 4));
  console.log("\x1b[36m├" + "─".repeat(width - 2) + "┤\x1b[0m");

  // Details
  console.log("\x1b[36m│\x1b[0m \x1b[33;1m📍 Location:\x1b[0m " + (listing.location || "N/A"));
  console.log("\x1b[36m│\x1b[0m \x1b[33;1m👤 Seller:\x1b[0m " + (listing.sellerName || "N/A"));
  if (listing.paylivery) {
    console.log("\x1b[36m│\x1b[0m \x1b[32;1m✅ PayLivery Available\x1b[0m");
  }
  console.log("\x1b[36m├" + "─".repeat(width - 2) + "┤\x1b[0m");

  // Footer
  console.log("\x1b[36m│\x1b[0m \x1b[33;1m🎯 Actions:\x1b[0m");
  console.log("\x1b[36m│\x1b[0m   [URL] Copy URL above to open in browser");
  console.log("\x1b[36m└" + "─".repeat(width - 2) + "┘\x1b[0m");
  console.log("");
  console.log("\x1b[90m" + "═".repeat(width) + "\x1b[0m");
  console.log("\x1b[90mPress Ctrl+C to exit, or copy URL above to view image\x1b[0m");
  console.log("\x1b[90m" + "═".repeat(width) + "\x1b[0m");
  console.log("");
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const productId = args[0];

  if (!productId) {
    console.log("Usage:");
    console.log("  npm run view <product-id>");
    console.log("");
    console.log("Example:");
    console.log("  npm run view 1837517241");
    process.exit(1);
  }

  // Load config
  const config = await getConfig();
  const width = config.asciiWidth;
  const asciiChars = ASCII_CHAR_SETS[config.asciiContrast];

  console.log("Fetching product ID: " + productId + "...");
  console.log("");

  try {
    const listing = await getListingDetails(productId);

    // Convert image to ASCII
    const imageUrl = listing.images?.[0] || listing.imageUrl;
    let asciiArt = null;

    if (imageUrl) {
      console.log("Converting image to ASCII (width: " + width + ", contrast: " + config.asciiContrast + ")...");
      asciiArt = await imageToAscii(imageUrl, width, asciiChars);
    }

    console.clear();
    console.log("");
    renderProductDetail(listing, asciiArt, width);
  } catch (error) {
    console.error("Error fetching product:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
