#!/usr/bin/env node

import { getListingDetails } from "./src/agents/search.js";
import { ListingDetail } from "./src/types.js";
import imageToAscii from "image-to-ascii";
import { promisify } from "node:util";

const imageToAsciiAsync = promisify(imageToAscii);

// ANSI escape code for clickable URL
function clickableUrl(url: string, label?: string): string {
  const text = label || url;
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}

interface AsciiOptions {
  width: number;
  height: number;
}

async function convertToAscii(imageUrl: string, options: AsciiOptions): Promise<string> {
  try {
    const result = await imageToAsciiAsync(imageUrl, options);
    return result;
  } catch (error) {
    console.error("ASCII conversion failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

// Render product detail view to console
function renderProductDetail(listing: ListingDetail, asciiArt: string | null = null): void {
  const hasImages = (listing.images && listing.images.length > 0) || !!listing.imageUrl;
  const imageUrl = listing.images?.[0] || listing.imageUrl || listing.url;

  console.log("");
  console.log("┌" + "─".repeat(70) + "┐");

  // Header
  const title = listing.title?.substring(0, 55) || "Unknown Product";
  console.log("│ " + (hasImages ? "📷 IMG  " : "NO IMG  ") + title.padEnd(60 - title.length) + "│");
  console.log("├" + "─".repeat(70) + "┤");

  // Price and ID
  console.log("│ 💰 " + (listing.priceText || listing.priceForDisplay || "N/A"));
  console.log("│ 🏷️  ID: " + listing.id);
  console.log("├" + "─".repeat(70) + "┤");

  // ASCII Art Image Preview
  console.log("│ 📷 Image Preview:");
  console.log("│");

  if (asciiArt) {
    // Show actual ASCII art
    const lines = asciiArt.split("\n");
    lines.slice(0, 12).forEach((line) => {
      if (line.trim()) {
        console.log("│ " + line.substring(0, 66));
      }
    });
  } else {
    // Show placeholder
    console.log("│      ┌──────────────────────────────┐");
    console.log("│      │                              │");
    console.log("│      │   [ 📷 IMAGE PREVIEW ]    │");
    console.log("│      │                              │");
    console.log("│      └──────────────────────────────┘");
  }
  console.log("│");
  console.log("├" + "─".repeat(70) + "┤");

  // Clickable URL
  console.log("│ 🔗 Image URL:");
  console.log("│   " + clickableUrl(imageUrl, imageUrl.substring(0, 60)));
  console.log("│   (Ctrl+Click or copy URL to view image)");
  console.log("├" + "─".repeat(70) + "┤");

  // Description
  const desc = listing.fullDescription || listing.description || "No description";
  // Strip HTML tags
  const cleanDesc = desc.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  console.log("│ 📝 Description:");
  console.log("│   " + cleanDesc.substring(0, 200));
  console.log("├" + "─".repeat(70) + "┤");

  // Details
  console.log("│ 📍 Location: " + (listing.location || "N/A"));
  console.log("│ 👤 Seller: " + (listing.sellerName || "N/A"));
  if (listing.paylivery) {
    console.log("│ ✅ PayLivery Available");
  }
  console.log("├" + "─".repeat(70) + "┤");

  // Attributes
  if (listing.attributes && Object.keys(listing.attributes).length > 0) {
    console.log("│ 📊 Attributes:");
    const attrs = Object.entries(listing.attributes).slice(0, 8);
    attrs.forEach(([key, val]) => {
      const value = Array.isArray(val) ? val.join(", ") : String(val);
      const line = "│   • " + key + ": " + value.substring(0, 60);
      console.log(line);
    });
    console.log("├" + "─".repeat(70) + "┤");
  }

  // Footer
  console.log("│ 🎯 Actions:");
  console.log("│   [URL] Copy URL above to open in browser");
  console.log("│   [ENTER] Open image in terminal (if supported)");
  console.log("└" + "─".repeat(70) + "┘");
  console.log("");
  console.log("═".repeat(72));
  console.log("Press Ctrl+C to exit, or copy URL above to view image");
  console.log("═".repeat(72));
  console.log("");
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const productId = args[0];

  if (!productId) {
    console.log("Usage:");
    console.log("  node view-product.js <product-id>");
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
      asciiArt = await convertToAscii(imageUrl, { width: 66, height: 15 });
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
