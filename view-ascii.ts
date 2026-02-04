import fs from "node:fs/promises";
import path from "node:path";

interface AsciiOptions {
  width?: number;
  height?: number;
  contrast?: boolean;
  invert?: boolean;
}

// Convert image URL to ASCII art
async function imageToAscii(imageUrl: string, options: AsciiOptions = {}): Promise<string> {
  const { width = 60, height = 30, contrast = true, invert = false } = options;

  try {
    // Download the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error("Failed to fetch image");
    }
    const buffer = await response.arrayBuffer();
    const imagePath = path.join("/tmp", path.basename(imageUrl.split("?")[0]));
    await fs.writeFile(imagePath, Buffer.from(buffer));

    // For now, return a simple ASCII representation
    // In a real implementation, we'd use a library like 'ascii-image-converter' or 'image-to-ascii'
    return await simpleAsciiConverter(imagePath, width, height);
  } catch (error) {
    console.error("Error converting image:", error instanceof Error ? error.message : error);
    return null;
  }
}

// Simple ASCII character set for grayscale conversion
const ASCII_CHARS = " .:-=+*#%@";

// Convert image to ASCII (simplified version)
async function simpleAsciiConverter(imagePath: string, width: number, height: number): Promise<string> {
  try {
    // For now, we'll create a simple pattern
    // In production, use: npm install ascii-image-converter
    const patterns = [
      `
  █████╗ ██╗   ██╗ █████╗ ██╗     ██╗  ██╗██╗ █████╗ ███████╗
  ██╔══██╗██║   ██║██╔══██╗██║     ██║  ██║██╔══██╗██╔════╝
  █████╔╝██║   ██║███████║██║     █████╔╝ ██║  ██║███████╗
  ██╔═██╗██║   ██║██╔══██║██║     ██╔══██╗ ██║  ██║╚════██║
  ██║  ██║╚██████╔╝███████╗██████╔╝ ██║  ██║███████╗
  ╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝
`,
      `
    ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
  ▄▀▀▀▀▄▄▀▀▀▀▄▄▀▀▀▀▀▄▄▀▀▀▀▀▀▄▄▀▀▀▀▀▀▀▄▄▀▀▀▀▀▀▀▄▄▀▀▀▀▀▀▀▄▄▀▀▀▀▀▀▀▄▄▀▀▀▀▀▀▀▄▄▀▀▀▀▀▀▀▄▄▀▀▀▀▀▀▀▄▄▀▀▀▀▀▀▀▄▄▀▀▀▀▀▀▀▄▄▀▀▀▀▀▀▀▄▄▀▀▀▀▀▀▀▄▄▀▀▀▀▀▀▀▄▄▀▀▀▀▀▀▀▄▄▀▀▀▀▀▀▀▄▄▀▀▀▀▀▀▀▄▄▀▀▀▀▀▀▀▄▄
      `,
      `
    ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
  ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
  ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
  ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
      `,
    ];

    return patterns[Math.floor(Math.random() * patterns.length)];
  } catch {
    return null;
  }
}

// Render product detail view to console
export function renderProductDetailAscii(
  listing: any,
  asciiArt: string | null = null
): string {
  const hasImages = (listing.images && listing.images.length > 0) || !!listing.imageUrl;
  const imageUrl = listing.images?.[0] || listing.imageUrl || listing.url;

  const lines: string[] = [];
  const w = 72;
  const border = "│";

  function addLine(line: string = "") {
    lines.push(line);
  }

  function addBorder(content: string = "") {
    addLine(border + " " + content.padEnd(w - 4) + " " + border);
  }

  function addSeparator() {
    addLine("├" + "─".repeat(w - 2) + "┤");
  }

  // Header
  addLine("┌" + "─".repeat(w - 2) + "┐");
  const title = listing.title?.substring(0, 55) || "Unknown Product";
  addBorder((hasImages ? "📷 IMG  " : "NO IMG  ") + title);
  addSeparator();

  // Price and ID
  addBorder("✅ " + (listing.priceText || listing.priceForDisplay || "N/A"));
  addBorder("🏷️  ID: " + listing.id);
  addSeparator();

  // ASCII Art Image Preview
  addBorder("📷 Image Preview:");
  if (asciiArt) {
    const artLines = asciiArt.split("\n").filter((l: string) => l.trim());
    artLines.slice(0, 8).forEach((line: string) => {
      addBorder("  " + line.substring(0, 65));
    });
  } else {
    addBorder("  ┌──────────────────────────────┐");
    addBorder("  │                              │");
    addBorder("  │   [ 📷 IMAGE PREVIEW ]    │");
    addBorder("  │                              │");
    addBorder("  └──────────────────────────────┘");
  }
  addSeparator();

  // Clickable URL
  addBorder("🔗 Image URL:");
  addBorder("  " + imageUrl);
  addBorder("  (Ctrl+Click or copy URL to view image)");
  addSeparator();

  // Description
  const desc = listing.fullDescription || listing.description || "No description";
  addBorder("📝 Description:");
  const descLines = desc.split(/<[^>]+>/g).join("").trim().substring(0, 200);
  addBorder("  " + descLines);
  addSeparator();

  // Details
  addBorder("📍 Location: " + (listing.location || "N/A"));
  addBorder("👤 Seller: " + (listing.sellerName || "N/A"));
  if (listing.paylivery) {
    addBorder("✅ PayLivery Available");
  }
  addSeparator();

  // Footer
  addBorder("🎯 Actions:");
  addBorder("  [URL] Copy URL above to open in browser");
  addLine("└" + "─".repeat(w - 2) + "┘");

  return lines.join("\n");
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const productId = args[0];

  if (!productId) {
    console.log("Usage: node view-ascii.js <product-id>");
    console.log("  npm run view-ascii <product-id>");
    process.exit(1);
  }

  console.log("Fetching product ID: " + productId + "...");
  console.log("");

  try {
    const { getListingDetails } = await import("./src/agents/search.js");
    const listing = await getListingDetails(productId);

    // Try to download and convert image to ASCII
    let asciiArt = null;
    const imageUrl = listing.images?.[0] || listing.imageUrl;
    if (imageUrl) {
      console.log("Converting image to ASCII...");
      asciiArt = await imageToAscii(imageUrl);
    }

    console.clear();
    console.log("");
    console.log(renderProductDetailAscii(listing, asciiArt));
    console.log("");
    console.log("═".repeat(w));
    console.log("Press Ctrl+C to exit, or copy URL above to view image");
    console.log("═".repeat(w));
    console.log("");
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
