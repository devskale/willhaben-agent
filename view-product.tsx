#!/usr/bin/env node

import { getListingDetails } from "./src/agents/search.js";
import { ListingDetail } from "./src/types.js";

// ANSI escape code for clickable URL
function clickableUrl(url: string, label?: string): string {
  const text = label || url;
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}

// Create ASCII image frame
function createImageFrame(hasImage: boolean): string {
  if (hasImage) {
    return `
 ┌──────────────┐
 │              │
 │   [ 📷 IMG]  │
 │              │
 └──────────────┘`;
  }

  return `
 ┌──────────────┐
 │              │
 │  [ NO IMG ]  │
 │              │
 └──────────────┘`;
}

// Render product detail view to console
function renderProductDetail(listing: ListingDetail): void {
  const hasImages = (listing.images && listing.images.length > 0) || !!listing.imageUrl;
  const imageUrl = listing.images?.[0] || listing.imageUrl || listing.url;

  console.clear();
  console.log("");
  console.log("┌" + "─".repeat(70) + "┐");

  // Header with image indicator
  const title = listing.title.length > 55
    ? listing.title.substring(0, 55) + "..."
    : listing.title;
  console.log("│ " + (hasImages ? "📷 IMG" : "NO IMG") + " ".repeat(60 - title.length) + "│");
  console.log("├" + "─".repeat(70) + "┤");

  // Title
  console.log("│ " + "✅ " + title);
  console.log("│ " + "💰 " + listing.priceText);
  console.log("│ " + "🏷️  ID: " + listing.id);
  console.log("├" + "─".repeat(70) + "┤");

  // Image preview section
  console.log("│ 📷 Image:");
  console.log("│ " + createImageFrame(hasImages).replace(/\n/g, "\n│ "));

  // Clickable URL section
  console.log("│ 🔗 URL:");
  console.log("│   " + clickableUrl(imageUrl, imageUrl));
  console.log("│   (Ctrl+Click or copy URL to open in browser)");
  console.log("├" + "─".repeat(70) + "┤");

  // Description
  const desc = listing.fullDescription || listing.description || "No description";
  const descLines = desc.match(/.{1,68}/g) || [desc];
  console.log("│ 📝 Description:");
  descLines.forEach((line: string) => {
    console.log("│   " + line);
  });
  console.log("├" + "─".repeat(70) + "┤");

  // Details
  console.log("│ 📍 Location: " + listing.location);
  console.log("│ 👤 Seller: " + listing.sellerName);
  if (listing.paylivery) {
    console.log("│ ✅ PayLivery Available");
  }
  console.log("├" + "─".repeat(70) + "┤");

  // Attributes
  if (listing.attributes && Object.keys(listing.attributes).length > 0) {
    console.log("│ 📊 Attributes:");
    const attrs = Object.entries(listing.attributes).slice(0, 10);
    attrs.forEach(([key, val]) => {
      const value = Array.isArray(val) ? val.join(", ") : String(val);
      const line = "│   • " + key + ": " + value;
      console.log("│   " + line.substring(0, 66));
    });
    console.log("├" + "─".repeat(70) + "┤");
  }

  // Actions
  console.log("│ 🎯 Actions:");
  console.log("│   [URL] Click or copy the URL above to open in browser");
  console.log("│   [ENTER] Open in default browser (if supported)");
  console.log("└" + "─".repeat(70) + "┘");
  console.log("");
  console.log("═".repeat(72));
  console.log("Press Ctrl+C to exit, or copy URL above to open in browser");
  console.log("═".repeat(72));
  console.log("");
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const productId = args[0] || args[1];

  if (!productId) {
    console.log("Usage:");
    console.log("  node view-product.js <product-id>");
    console.log("  bun run view-product.tsx <product-id>");
    console.log("");
    console.log("Example:");
    console.log("  node view-product.js 1837517241");
    process.exit(1);
  }

  console.log("Fetching product ID: " + productId + "...");
  console.log("");

  try {
    const listing = await getListingDetails(productId);
    renderProductDetail(listing);
  } catch (error) {
    console.error("Error fetching product:");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
