/**
 * Immobilien search — completely separate from Marktplatz.
 *
 * Uses /webapi/iad/search/atz/2/{searchId} endpoint.
 * Server-side filtering via query params (PRICE_TO, ESTATE_SIZE/LIVING_AREA_FROM, etc).
 *
 * Domain: willhaben.at Immobilien (vertical 2) only.
 * Marktplatz lives in search-marktplatz.ts.
 */

import { getPublicHeaders } from '../lib/http.js';
import {
  parsePrice,
  parseEstateSize,
  parseRooms,
  computePricePerSqm,
} from "../lib/price.js";
import type { Listing } from "../types.js";

import { WH_CLIENT, UA, BASE_URL } from '../lib/constants.js';

// ─── Types ────────────────────────────────────────────────────────────────

/** Server-side filter params for Immo API */
export interface ImmoFilters {
  priceFrom?: number;
  priceTo?: number;
  estateSizeFrom?: number;
  estateSizeTo?: number;
  rooms?: number;           // exact → NO_OF_ROOMS_BUCKET=NxN
  propertyType?: string;   // PROPERTY_TYPE ID
}

/** Map friendly type names to searchIds */
export const IMMO_TYPE_MAP: Record<string, number> = {
  alle: 90,
  wohnung: 101,
  eigentumswohnung: 101,
  mietwohnung: 131,
  haus: 102,
  miethaus: 132,
  grundstück: 14,
  grundstueck: 14,
  gewerbe: 15,
  gewerbe_mieten: 16,
  ferien: 12,
  ferien_mieten: 32,
  neubau: 42,
  sonstige: 35,
};

export interface ImmoVerticalConfig {
  vertical: number;
  category: string;
  htmlPath: string;
  searchId: number;
}

export const IMMO_VERTICALS: Record<string, ImmoVerticalConfig> = {
  immobilien:   { vertical: 2, category: "100", htmlPath: "immobilien",                      searchId: 90 },
  wohnungen:    { vertical: 2, category: "101", htmlPath: "immobilien/eigentumswohnung/...",   searchId: 101 },
  hauser:       { vertical: 2, category: "102", htmlPath: "immobilien/haus/haus-angebote",     searchId: 102 },
};

export const resolveImmoVertical = (v?: string): ImmoVerticalConfig | null =>
  IMMO_VERTICALS[v || ""] || null;

// ─── API Item Type ───────────────────────────────────────────────────────

export interface ImmoApiItem {
  id: number;
  description: string;
  attributes: { attribute: Array<{ name: string; values: string[] }> };
  advertImageList?: {
    advertImage?: Array<{ mainImageUrl?: string }>;
  };
}

/** Parse attribute list into flat map */
export const parseImmoAttributes = (item: ImmoApiItem): Record<string, string> => {
  const attrs: Record<string, string> = {};
  for (const a of item.attributes?.attribute || []) {
    if (a.name && a.values?.[0] !== undefined) attrs[a.name] = a.values[0];
  }
  return attrs;
};

// ─── Build Filter Params ─────────────────────────────────────────────────

const buildImmoParams = (
  areaIds: number[] | undefined,
  rows: number,
  page: number,
  filters?: ImmoFilters,
): URLSearchParams => {
  const params = new URLSearchParams({
    rows: String(rows),
    isNavigation: "true",
    page: String(page),
  });
  if (areaIds?.length) for (const aid of areaIds) params.append("areaId", String(aid));
  if (filters?.priceFrom)     params.set("PRICE_FROM", String(filters.priceFrom));
  if (filters?.priceTo)       params.set("PRICE_TO", String(filters.priceTo));
  if (filters?.estateSizeFrom) params.set("ESTATE_SIZE/LIVING_AREA_FROM", String(filters.estateSizeFrom));
  if (filters?.estateSizeTo)   params.set("ESTATE_SIZE/LIVING_AREA_TO", String(filters.estateSizeTo));
  if (filters?.rooms)          params.set("NO_OF_ROOMS_BUCKET", `${filters.rooms}X${filters.rooms}`);
  if (filters?.propertyType)   params.set("PROPERTY_TYPE", filters.propertyType);
  return params;
};

// ─── Raw Fetch (shared by search + overview) ─────────────────────────────

/**
 * Raw fetch from Immo API. Returns raw items + rowsFound.
 * Used by both searchImmo (full listings) and getImmoOverview (stats-only).
 */
export const fetchImmoApi = async (
  searchId: number,
  areaIds?: number[],
  rows: number = 30,
  page: number = 1,
  filters?: ImmoFilters,
): Promise<{ items: ImmoApiItem[]; rowsFound: number }> => {
  try {
    const { headers } = await getPublicHeaders();
    const params = buildImmoParams(areaIds, rows, page, filters);
    const url = `https://www.willhaben.at/webapi/iad/search/atz/2/${searchId}?${params}`;

    const resp = await fetch(url, { headers });

    if (!resp.ok) return { items: [], rowsFound: 0 };

    const data = await resp.json() as {
      advertSummary?: ImmoApiItem[];
      advertSummaryList?: { advertSummary?: ImmoApiItem[] };
      rowsFound?: number;
    };

    return {
      items: data.advertSummary || data.advertSummaryList?.advertSummary || [],
      rowsFound: typeof data.rowsFound === 'number' ? data.rowsFound : 0,
    };
  } catch {
    return { items: [], rowsFound: 0 };
  }
};

// ─── Parse Single Item ───────────────────────────────────────────────────

/**
 * Parse one Immo API item → Partial<Listing>.
 * All math done deterministically — no LLM math.
 */
export const parseImmoItem = (item: ImmoApiItem): Partial<Listing> => {
  const a = parseImmoAttributes(item);
  const rawPrice = a["PRICE"] || a["ESTATE_PRICE/PRICE_SUGGESTION"] || a["PRICE_FOR_DISPLAY"];
  const price = parsePrice(rawPrice);
  const oldPrice = parsePrice(a["OLD_PRICE"] || a["OLD_PRICE_FOR_DISPLAY"]);
  const estateSize = parseEstateSize(a["ESTATE_SIZE"] || a["ESTATE_SIZE/LIVING_AREA"] || a["PLOT/AREA"]);
  const rooms = parseRooms(a["NUMBER_OF_ROOMS"] || a["ROOMS"]);

  return {
    id: String(item.id),
    title: typeof item.description === 'string' ? item.description : '',
    price,
    priceText: a["PRICE_FOR_DISPLAY"] || (price !== null ? `€ ${price}` : ""),
    oldPrice,
    oldPriceText: a["OLD_PRICE_FOR_DISPLAY"] || (oldPrice !== null ? `€ ${oldPrice}` : undefined),
    isPrivate: a["ISPRIVATE"] === "1",
    coordinates: a["COORDINATES"],
    imageUrl: item.advertImageList?.advertImage?.[0]?.mainImageUrl,
    location: [a["POSTCODE"], a["LOCATION"]].filter(Boolean).join(", "),
    sellerId: a["ORGID"],
    sellerName: a["ORGNAME"] || a["CONTACT/NAME"] || "",
    paylivery: a["p2penabled"] === "true",
    publishedAt: a["PUBLISHED_String"],
    condition: a["CONDITION"] || "",
    estateSize,
    rooms,
    floor: a["FLOOR"] || undefined,
    propertyType: a["PROPERTY_TYPE"] || undefined,
    pricePerSqm: computePricePerSqm(price, estateSize),
  };
};

// ─── Search Immo ─────────────────────────────────────────────────────────

export interface ImmoSearchResult {
  items: Listing[];
  totalFound: number;
}

/**
 * Search Immobilien — returns enriched listings + totalFound.
 * Delegates to fetchImmoApi + parseImmoItem.
 */
export const searchImmo = async (
  searchId: number,
  areaIds?: number[],
  rows: number = 30,
  filters?: ImmoFilters,
  maxPages: number = 1,
): Promise<ImmoSearchResult> => {
  const { items: rawItems, rowsFound } = await fetchImmoApi(searchId, areaIds, rows, 1, filters);

  const items: Listing[] = [];
  const seen = new Set<string>();
  pushImmoItems(rawItems, items, seen);

  // Fetch additional pages
  const pagesNeeded = Math.min(maxPages, Math.ceil(rowsFound / rows));
  if (pagesNeeded > 1) {
    const extraPages = Array.from({ length: pagesNeeded - 1 }, (_, i) => i + 2);
    const extraResults = await Promise.all(
      extraPages.map(p => fetchImmoApi(searchId, areaIds, rows, p, filters))
    );
    for (const res of extraResults) {
      pushImmoItems(res.items, items, seen);
    }
  }

  return { items, totalFound: rowsFound || items.length };
};

function pushImmoItems(rawItems: ImmoApiItem[], items: Listing[], seen: Set<string>): void {
  for (const item of rawItems) {
    const parsed = parseImmoItem(item);
    if (!parsed.id || seen.has(parsed.id)) continue;
    seen.add(parsed.id);

    items.push({
      id: parsed.id,
      title: parsed.title || "",
      price: parsed.price ?? null,
      priceText: parsed.priceText || "",
      oldPrice: parsed.oldPrice ?? null,
      oldPriceText: parsed.oldPriceText,
      location: parsed.location || "",
      description: "",
      url: `${BASE_URL}/iad/object?adId=${parsed.id}`,
      imageUrl: parsed.imageUrl,
      isPrivate: parsed.isPrivate,
      coordinates: parsed.coordinates,
      sellerId: parsed.sellerId,
      sellerName: parsed.sellerName || "",
      publishedAt: parsed.publishedAt,
      condition: parsed.condition || "",
      paylivery: parsed.paylivery ?? false,
      estateSize: parsed.estateSize ?? null,
      rooms: parsed.rooms ?? null,
      floor: parsed.floor ?? null,
      propertyType: parsed.propertyType ?? null,
      pricePerSqm: parsed.pricePerSqm ?? null,
    });
  }
}

// ─── District Overview / Stats ───────────────────────────────────────────

export interface DistrictStats {
  areaId: number;
  name: string;
  types: Record<string, {
    totalFound: number;
    priceMin: number | null;
    priceMedian: number | null;
    priceMax: number | null;
    sizeMin: number | null;
    sizeMedian: number | null;
    sizeMax: number | null;
    ppm2Median: number | null;
    ppm2Min: number | null;
    ppm2Max: number | null;
  }>;
}

const EMPTY_TYPE_STATS = {
  totalFound: 0, priceMin: null, priceMedian: null, priceMax: null,
  sizeMin: null, sizeMedian: null, sizeMax: null,
  ppm2Median: null, ppm2Min: null, ppm2Max: null,
};

const sortedStat = (arr: number[]): { min: number | null; median: number | null; max: number | null } =>
  arr.length === 0
    ? { min: null, median: null, max: null }
    : { min: arr[0], median: arr[Math.floor(arr.length / 2)], max: arr[arr.length - 1] };

/**
 * Multi-district immo stats. All math is deterministic here.
 * Reuses fetchImmoApi — no duplicate HTTP code.
 */
export const getImmoOverview = async (
  areaIds: { areaId: number; name: string }[],
  searchTypes: { searchId: number; label: string }[] = [
    { searchId: 131, label: 'Mietwohnung' },
    { searchId: 101, label: 'Eigentumswohnung' },
    { searchId: 102, label: 'Haus kaufen' },
  ],
  rows: number = 30,
  filters?: ImmoFilters,
): Promise<DistrictStats[]> => {
  const overview: DistrictStats[] = [];

  for (const area of areaIds) {
    const stats: DistrictStats = { areaId: area.areaId, name: area.name, types: {} };

    for (const st of searchTypes) {
      try {
        const { items, rowsFound } = await fetchImmoApi(st.searchId, [area.areaId], rows, 1, filters);

        const prices: number[] = [];
        const sizes: number[] = [];
        const ppsms: number[] = [];

        for (const item of items) {
          const a = parseImmoAttributes(item);
          const price = parsePrice(a['PRICE'] || a['ESTATE_PRICE/PRICE_SUGGESTION']);
          const size = parseEstateSize(a['ESTATE_SIZE'] || a['ESTATE_SIZE/LIVING_AREA']);
          if (price !== null) prices.push(price);
          if (size !== null) sizes.push(size);
          if (price !== null && size !== null && size > 0) ppsms.push(Math.round(price / size));
        }

        prices.sort((a, b) => a - b);
        sizes.sort((a, b) => a - b);
        ppsms.sort((a, b) => a - b);

        const ps = sortedStat(prices);
        const ss = sortedStat(sizes);
        const p2s = sortedStat(ppsms);

        stats.types[st.label] = {
          totalFound: rowsFound,
          priceMin: ps.min, priceMedian: ps.median, priceMax: ps.max,
          sizeMin: ss.min, sizeMedian: ss.median, sizeMax: ss.max,
          ppm2Median: p2s.median, ppm2Min: p2s.min, ppm2Max: p2s.max,
        };
      } catch {
        stats.types[st.label] = { ...EMPTY_TYPE_STATS };
      }
    }
    overview.push(stats);
  }

  return overview;
};

export interface ImmoFilterSchema {
  group: string;
  id: string;
  label: string;
  type: string;
  selectionType: string;
  params: string[];
}
