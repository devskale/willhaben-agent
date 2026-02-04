import { getListingDetails } from "./src/agents/search.js";

const productId = process.argv[2] || "1770285540";

console.log("Fetching product ID: " + productId + "...");

try {
  const listing = await getListingDetails(productId);
  console.log("\n=== LISTING DETAILS ===");
  console.log("ID:", listing.id);
  console.log("Title:", listing.title);
  console.log("Images:", listing.images);
  console.log("Image URL:", listing.imageUrl);
  console.log("\nAll properties:");
  Object.keys(listing).forEach((key) => {
    if (key.toLowerCase().includes("image") || key.toLowerCase().includes("pic") || key.toLowerCase().includes("photo")) {
      console.log("  " + key + ":", (listing as any)[key]);
    }
  });
} catch (error) {
  console.error("Error:", error instanceof Error ? error.message : error);
}
