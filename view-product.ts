#!/usr/bin/env node

import { getListingDetails } from "./src/agents/search.js";
import { ListingDetail } from "../types.js";

// ANSI escape code for clickable URL
function clickableUrl(url: string, label?: string): string {
  const text = label || url;
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}

// Simple grayscale ASCII conversion
async function imageToAscii(imageUrl: string, maxWidth: number = 62): Promise<string | null> {
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

      // Convert to grayscale ASCII
      let ascii = "";
      const chars = " .·░▒▓█"; // Light to dark for visibility on dark bg

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
    // Create a simple placeholder with brighter characters
    const lines = [
      "                                                  ",
      "   ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄   ",
      "  ████████████████████████████████████████████  ",
      "  ██▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄██  ",
      "  ██  ██  ██  ██  ██  ██  ██  ██  ██  ██  ██  ",
      "  ██  ██  ██  ██  ██  ██  ██  ██  ██  ██  ██  ",
      "  ██  ██  ██  ██  ██  ██  ██  ██  ██  ██  ██  ",
      "  ██▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀██  ",
      "   ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀   ",
      "                                                  ",
    ];
    return lines.join("\n");
  } catch {
    return null;
  }
}

// Render product detail view to console
function renderProductDetail(listing: ListingDetail, asciiArt: string | null = null): void {
  const hasImages = (listing.images && listing.images.length > 0) || !!listing.imageUrl;
  const imageUrl = listing.images?.[0] || listing.imageUrl || listing.url;

  console.log("");
  console.log("\x1b[36m┌" + "─".repeat(70) + "┐\x1b[0m"); // Cyan border

  // Header
  const title = listing.title?.substring(0, 55) || "Unknown Product";
  console.log("\x1b[36m│\x1b[0m " + (hasImages ? "\x1b[32;1m📷 IMG  \x1b[0m" : "\x1b[31mNO IMG  \x1b[0m") + title.padEnd(60 - title.length) + "\x1b[36m│\x1b[0m");
  console.log("\x1b[36m├" + "─".repeat(70) + "┤\x1b[0m");

  // Price and ID
  console.log("\x1b[36m│\x1b[0m \x1b[33;1m💰\x1b[0m " + (listing.priceText || listing.priceForDisplay || "N/A"));
  console.log("\x1b[36m│\x1b[0m \x1b[33;1m🏷️ \x1b[0m ID: " + listing.id);
  console.log("\x1b[36m├" + "─".repeat(70) + "┤\x1b[0m");

  // ASCII Art Image Preview
  console.log("\x1b[36m│\x1b[0m \x1b[32;1m📷 Image Preview:\x1b[0m");
  console.log("\x1b[36m│\x1b[0m");

  if (asciiArt) {
    // Show actual ASCII art with bright green color
    const lines = asciiArt.split("\n");
    lines.forEach((line) => {
      if (line.trim()) {
        console.log("\x1b[32;1m│ " + line.substring(0, 66) + "\x1b[0m");
      } else {
        console.log("\x1b[36m│\x1b[0m");
      }
    });
  } else {
    // Show placeholder
    console.log("\x1b[36m│\x1b[0m      \x1b[32;1m┌──────────────────────────────┐\x1b[0m");
    console.log("\x1b[36m│\x1b[0m      \x1b[32;1m│\x1b[0m                              \x1b[32;1m│\x1b[0m");
    console.log("\x1b[36m│\x1b[0m      \x1b[32;1m│\x1b[0m   \x1b[33;1m[ 📷 IMAGE PREVIEW ]\x1b[0m   \x1b[32;1m│\x1b[0m");
    console.log("\x1b[36m│\x1b[0m      \x1b[32;1m│\x1b[0m                              \x1b[32;1m│\x1b[0m");
    console.log("\x1b[36m│\x1b[0m      \x1b[32;1m└──────────────────────────────┘\x1b[0m");
  }
  console.log("\x1b[36m│\x1b[0m");
  console.log("\x1b[36m├" + "─".repeat(70) + "┤\x1b[0m");

  // Clickable URL
  console.log("\x1b[36m│\x1b[0m \x1b[34;1m🔗 Image URL:\x1b[0m");
  console.log("\x1b[36m│\x1b[0m   " + clickableUrl(imageUrl, imageUrl.substring(0, 60)));
  console.log("\x1b[36m│\x1b[0m   \x1b[90m(Ctrl+Click or copy URL to view image)\x1b[0m");
  console.log("\x1b[36m├" + "─".repeat(70) + "┤\x1b[0m");

  // Description
  const desc = listing.fullDescription || listing.description || "No description";
  const cleanDesc = desc.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  console.log("\x1b[36m│\x1b[0m \x1b[33;1m📝 Description:\x1b[0m");
  console.log("\x1b[36m│\x1b[0m   " + cleanDesc.substring(0, 200));
  console.log("\x1b[36m├" + "─".repeat(70) + "┤\x1b[0m");

  // Details
  console.log("\x1b[36m│\x1b[0m \x1b[33;1m📍 Location:\x1b[0m " + (listing.location || "N/A"));
  console.log("\x1b[36m│\x1b[0m \x1b[33;1m👤 Seller:\x1b[0m " + (listing.sellerName || "N/A"));
  if (listing.paylivery) {
    console.log("\x1b[36m│\x1b[0m \x1b[32;1m✅ PayLivery Available\x1b[0m");
  }
  console.log("\x1b[36m├" + "─".repeat(70) + "┤\x1b[0m");

  // Footer
  console.log("\x1b[36m│\x1b[0m \x1b[33;1m🎯 Actions:\x1b[0m");
  console.log("\x1b[36m│\x1b[0m   [URL] Copy URL above to open in browser");
  console.log("\x1b[36m└" + "─".repeat(70) + "┘\x1b[0m");
  console.log("");
  console.log("\x1b[90m═══════════════════════════════════════════════════════════════════════\x1b[0m");
  console.log("\x1b[90mPress Ctrl+C to exit, or copy URL above to view image\x1b[0m");
  console.log("\x1b[90m═══════════════════════════════════════════════════════════════════════\x1b[0m");
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

  console.log("Fetching product ID: " + productId + "...");
  console.log("");

  try {
    const listing = await getListingDetails(productId);

    // Convert image to ASCII
    const imageUrl = listing.images?.[0] || listing.imageUrl;
    let asciiArt = null;

    if (imageUrl) {
      console.log("Converting image to ASCII...");
      asciiArt = await imageToAscii(imageUrl, 50);
    }

    console.clear();
    console.log("");
    renderProductDetail(listing, asciiArt);
  } catch (error) {
    console.error("Error fetching product:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
