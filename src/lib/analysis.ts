/**
 * Analysis & filtering utilities for willhaben listings.
 * No LLM math — all computation is deterministic.
 */

import type { Listing } from "../types.js";

// ─── Keyword Filters ──────────────────────────────────────────────────────

/**
 * Filter listings where title OR description matches ANY keyword (OR logic).
 * Case-insensitive substring match.
 */
export function filterByKeyword(items: Listing[], keywords: string[], searchDescription = false): Listing[] {
  if (!keywords.length) return items;
  const lower = keywords.map(k => k.toLowerCase());
  return items.filter(item => {
    const title = (item.title || "").toLowerCase();
    const desc = searchDescription ? (item.description || "").toLowerCase() : "";
    const text = searchDescription ? `${title} ${desc}` : title;
    return lower.some(kw => text.includes(kw));
  });
}

/**
 * Exclude listings where title OR description matches ANY exclude keyword.
 */
export function excludeByKeyword(items: Listing[], excludes: string[], searchDescription = false): Listing[] {
  if (!excludes.length) return items;
  const lower = excludes.map(k => k.toLowerCase());
  return items.filter(item => {
    const title = (item.title || "").toLowerCase();
    const desc = searchDescription ? (item.description || "").toLowerCase() : "";
    const text = searchDescription ? `${title} ${desc}` : title;
    return !lower.some(kw => text.includes(kw));
  });
}

// ─── Property Type Classification ───────────────────────────────────────

export const PROPERTY_TYPE_GROUPS = {
  mietobjekt: ["mietwohnung", "mietobjekt", "miete"],
  wohnung: ["wohnung", "eigentumswohnung", "apartment", "whg", "garconniere", "dachgeschoss", "maisonette", "erdgeschoss"],
  haus: ["haus", "einfamilienhaus", "mehrfamilienhaus", "reihenhaus", "villa", "doppelhaushälfte", "bungalow"],
  grundstück: ["grundstück", "baugrund", "bauland", "plot"],
  gewerbe: ["gewerbe", "gewerbeimmobilie", "büro", "geschäft", "ladenlokal", "lager", "hall", "praxis", "ordinierung", "hotel", "gastgewerbe"],
  garage: ["garage", "parkplatz", "stellplatz", "carport"],
} as const;

export type PropertyTypeGroup = keyof typeof PROPERTY_TYPE_GROUPS;

/**
 * Classify a listing into a property type group.
 * Checks title + propertyType field against keyword groups.
 */
export function classifyPropertyType(item: Listing): PropertyTypeGroup | null {
  const text = (
    (item.title || "") + " " +
    (item.propertyType || "") + " " +
    (item.description || "")
  ).toLowerCase();

  // Check in priority order (more specific first)
  for (const [group, keywords] of Object.entries(PROPERTY_TYPE_GROUPS)) {
    if (keywords.some((kw) => text.includes(kw))) {
      return group as PropertyTypeGroup;
    }
  }

  return null;
}

/**
 * Filter listings by property type group.
 */
export function filterByType(items: Listing[], type: PropertyTypeGroup | string): Listing[] {
  const normalized = type.toLowerCase() as PropertyTypeGroup;
  return items.filter((item) => classifyPropertyType(item) === normalized);
}

// ─── Size / Room Filters ──────────────────────────────────────────────────

/**
 * Filter by estate size range.
 */
export function filterBySize(
  items: Listing[],
  minSize?: number,
  maxSize?: number,
): Listing[] {
  // If no bounds specified, pass through (null size = unknown, not invalid)
  if (minSize === undefined && maxSize === undefined) return items;
  return items.filter((item) => {
    const size = item.estateSize;
    if (size === null) return true; // unknown size → keep
    if (minSize !== undefined && size < minSize) return false;
    if (maxSize !== undefined && size > maxSize) return false;
    return true;
  });
}

/**
 * Filter by room count (exact or minimum).
 */
export function filterByRooms(
  items: Listing[],
  rooms?: number,
  minRooms?: number,
): Listing[] {
  // If no bounds specified, pass through
  if (rooms === undefined && minRooms === undefined) return items;
  return items.filter((item) => {
    const r = item.rooms;
    if (r === null) return true; // unknown → keep
    const numR = typeof r === "string" ? parseInt(r, 10) : r;
    if (isNaN(numR)) return false;
    if (rooms !== undefined && numR !== rooms) return false;
    if (minRooms !== undefined && numR < minRooms) return false;
    return true;
  });
}

// ─── Price Filters ────────────────────────────────────────────────────────

/**
 * Filter by price range. Rentals are typically < €10k/month, buys ≥ €10k.
 */
export function filterByPrice(
  items: Listing[],
  minPrice?: number,
  maxPrice?: number,
): Listing[] {
  return items.filter((item) => {
    const price = item.price;
    if (price === null) return false;
    if (minPrice !== undefined && price < minPrice) return false;
    if (maxPrice !== undefined && price > maxPrice) return false;
    return true;
  });
}

/**
 * Separate rentals (low price) from purchases (high price).
 * Threshold: €10,000 (rentals are monthly, purchases are total).
 */
export function separateRentalsAndBuys(items: Listing[]): { rentals: Listing[]; buys: Listing[] } {
  const RENT_THRESHOLD = 10_000;
  const rentals: Listing[] = [];
  const buys: Listing[] = [];

  for (const item of items) {
    if (item.price === null) continue;
    if (item.price < RENT_THRESHOLD) {
      rentals.push(item);
    } else {
      buys.push(item);
    }
  }

  return { rentals, buys };
}

// ─── Statistics ───────────────────────────────────────────────────────────

interface PriceStats {
  count: number;
  min: number | null;
  max: number | null;
  median: number | null;
  mean: number | null;
}

/**
 * Compute basic price statistics (no LLM math).
 */
export function computeStats(prices: (number | null)[]): PriceStats {
  const valid = prices.filter((p): p is number => p !== null);
  if (valid.length === 0) {
    return { count: 0, min: null, max: null, median: null, mean: null };
  }

  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;

  const sum = sorted.reduce((a, b) => a + b, 0);

  return {
    count: valid.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median,
    mean: sum / valid.length,
  };
}

/**
 * Full analysis of search results.
 */
export interface AnalysisResult {
  totalItems: number;
  byType: Record<string, { count: number; medianPrice: number | null; medianSqm: number | null; minPrice: number; maxPrice: number }>;
  bestValue: Listing[];           // lowest €/m² with valid data
  privateSellers: Listing[];
  priceStats: {
    all: PriceStats;
    buys: PriceStats;
    rentals: PriceStats;
  };
  sqmStats: PriceStats;
}

export function analyzeListings(items: Listing[]): AnalysisResult {
  // Group by property type
  const byType: AnalysisResult["byType"] = {};
  for (const item of items) {
    const type = classifyPropertyType(item) || "sonstige";
    if (!byType[type]) {
      byType[type] = { count: 0, medianPrice: null, medianSqm: null, minPrice: Infinity, maxPrice: 0 };
    }
    byType[type].count++;
    if (item.price !== null) {
      byType[type].minPrice = Math.min(byType[type].minPrice, item.price);
      byType[type].maxPrice = Math.max(byType[type].maxPrice, item.price);
    }
  }

  // Compute per-type medians
  for (const [type, group] of Object.entries(byType)) {
    const typeItems = items.filter((i) => classifyPropertyType(i) === type || (classifyPropertyType(i) === null && type === "sonstige"));
    const prices = typeItems.map((i) => i.price);
    const sqms = typeItems.map((i) => i.pricePerSqm).filter((s): s is number => s !== null);
    group.medianPrice = computeStats(prices).median;
    group.medianSqm = computeStats(sqms).median;
  }

  // Best value: lowest €/m² with valid data, reasonable size (>20m²), buy price (€10k+)
  const bestValue = items
    .filter((i) => i.estateSize !== null && i.estateSize > 20 && i.pricePerSqm !== null && i.price !== null && i.price >= 10_000)
    .sort((a, b) => (a.pricePerSqm ?? Infinity) - (b.pricePerSqm ?? Infinity));

  // Private sellers
  const privateSellers = items.filter((i) => i.isPrivate);

  // Price stats
  const allPrices = items.map((i) => i.price);
  const { rentals, buys } = separateRentalsAndBuys(items);

  return {
    totalItems: items.length,
    byType,
    bestValue: bestValue.slice(0, 10),
    privateSellers,
    priceStats: {
      all: computeStats(allPrices),
      buys: computeStats(buys.map((i) => i.price)),
      rentals: computeStats(rentals.map((i) => i.price)),
    },
    sqmStats: computeStats(items.map((i) => i.pricePerSqm)),
  };
}

// ─── Comparison ───────────────────────────────────────────────────────────

/**
 * Create a compact comparison row for a listing.
 */
export function listingSummary(item: Listing): Record<string, unknown> {
  return {
    id: item.id,
    title: item.title?.substring(0, 80),
    price: item.price,
    priceText: item.priceText,
    pricePerSqm: item.pricePerSqm,
    estateSize: item.estateSize,
    rooms: item.rooms,
    floor: item.floor,
    propertyType: item.propertyType || classifyPropertyType(item),
    location: item.location,
    isPrivate: item.isPrivate,
    condition: item.condition || null,
    sellerName: item.sellerName || null,
    url: item.url,
  };
}

/**
 * Compare multiple listings side-by-side.
 */
export function compareListings(listings: Listing[]): {
  comparison: Record<string, unknown>[];
  fields: string[];
} {
  const fields = [
    "title", "price", "priceText", "pricePerSqm",
    "estateSize", "rooms", "floor", "propertyType",
    "location", "isPrivate", "condition", "sellerName",
    "url",
  ];

  return {
    comparison: listings.map(listingSummary),
    fields,
  };
}
