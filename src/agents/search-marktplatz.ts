/**
 * Marktplatz search — completely separate from Immobilien.
 *
 * Uses /webapi/ad-search/search/atz/{vertical}/{category}/atverz endpoint
 * plus HTML __NEXT_DATA__ fallback.
 *
 * Domain: willhaben.at Marktplatz (vertical 5), Auto (vertical 3), etc.
 * NOT: Immobilien (vertical 2) — that lives in search-immo.ts
 */

import { checkAuth, getVisitorCookies } from "./auth.js";
import { load } from "cheerio";
import {
  Listing,
  SearchResult,
  Seller,
  CategorySuggestion,
  CategoryTree,
  CategoryNode,
} from "../types.js";
import {
  parsePrice,
  parseEstateSize,
  parseRooms,
  computePricePerSqm,
} from "../lib/price.js";

const WH_CLIENT = "api@willhaben.at;responsive_web;server;1.0.0;desktop";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const BASE_URL = "https://www.willhaben.at";

// ─── Marktplatz Vertical Config ──────────────────────────────────────────

export interface MarktplatzVertical {
  vertical: number;
  category: string;
  htmlPath: string;
}

export const MARKTPLATZ_VERTICALS: Record<string, MarktplatzVertical> = {
  marktplatz: { vertical: 5, category: "301", htmlPath: "kaufen-und-verkaufen/marktplatz" },
  auto:       { vertical: 3, category: "101", htmlPath: "auto/motorwagen" },
};

export const resolveMarktplatzVertical = (v?: string): MarktplatzVertical =>
  MARKTPLATZ_VERTICALS[v || "marktplatz"] || MARKTPLATZ_VERTICALS.marktplatz;

// ─── Shared Helpers ───────────────────────────────────────────────────────

const getHeaders = (cookies: string) => ({
  "User-Agent": UA,
  Cookie: cookies,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "de-AT,de;q=0.9,en;q=0.8",
});

/** Parse attribute list from JSON API item into a flat map. */
export const parseApiAttributes = (item: any): Record<string, string> => {
  const attrs: Record<string, string> = {};
  const list = item.attributes?.attribute || [];
  for (const a of list) {
    if (a.name && a.values?.[0] !== undefined) {
      attrs[a.name] = a.values[0];
    }
  }
  return attrs;
};

const parseAttributes = (item: any): Record<string, any> => {
  const attrsData = item.attributes || {};
  let attrsList: any[] = [];
  if (Array.isArray(attrsData)) {
    attrsList = attrsData;
  } else if (attrsData.attribute) {
    attrsList = attrsData.attribute;
  }
  const attributes: Record<string, any> = {};
  for (const attr of attrsList) {
    if (attr.name) attributes[attr.name] = attr.values || [];
  }
  return attributes;
};

// ─── Parse HTML Listing (from __NEXT_DATA__) ─────────────────────────────

const parseListing = (item: any): Listing => {
  const attributes = parseAttributes(item);

  let price: number | null = null;
  let priceText = "";

  if (attributes["PRICE_FOR_DISPLAY"]?.[0]) priceText = attributes["PRICE_FOR_DISPLAY"][0];

  const rawPrice = attributes["PRICE/AMOUNT"]?.[0] || attributes["PRICE"]?.[0];
  if (rawPrice) {
    try {
      price = parseFloat(rawPrice);
      if (!priceText) priceText = `€ ${price.toLocaleString("de-AT", { minimumFractionDigits: 2 })}`;
    } catch { /* ignore */ }
  }

  const locationParts = [
    ...(attributes["POSTCODE"] || []),
    ...(attributes["LOCATION"] || []),
  ];

  const title =
    typeof item.description === "string"
      ? item.description
      : item.description?.header || "No Title";

  return {
    id: item.id,
    title,
    price,
    priceText,
    location: locationParts.join(", "),
    description: item.body || "",
    url: `${BASE_URL}/iad/object?adId=${item.id}`,
    imageUrl:
      item.mainImageUrl ||
      item.advertImageList?.advertImage?.[0]?.mainImageUrl,
    sellerId: attributes["SELLER_ID"]?.[0],
    sellerName: attributes["SELLER_NAME"]?.[0] || "",
    condition: attributes["CONDITION"]?.[0] || "",
    paylivery: !!attributes["PAYLIVERY"],
    estateSize: null,
    rooms: null,
    floor: null,
    propertyType: null,
    pricePerSqm: null,
  };
};

// ─── Marktplatz Filters (server-side) ─────────────────────────────────────

/** Server-side filter params for Marktplatz API. Completely separate from ImmoFilters. */
export interface MarktplatzFilters {
  priceFrom?: number;
  priceTo?: number;
  condition?: string;     // 'neu' | 'neuwertig' | 'gebraucht' | 'defekt'
  isPrivate?: boolean;    // true = Privat, false = Händler
  shipping?: boolean;     // true = Versand, false = Selbstabholung
  paylivery?: boolean;    // Only PayLivery listings
  period?: number;        // 2 = last 48h
}

/** Map friendly condition names to treeAttributes values */
export const CONDITION_MAP: Record<string, string> = {
  neu: '22',
  neuwertig: '2546',
  gebraucht: '23',
  defekt: '24',
};

// ─── Marktplatz JSON API ──────────────────────────────────────────────────

export interface MarktplatzApiItem {
  id: number;
  description: string;
  attributes: { attribute: Array<{ name: string; values: string[] }> };
  advertImageList?: {
    advertImage?: Array<{ mainImageUrl?: string }>;
  };
}

/**
 * Build Marktplatz API params from filters. Single place that knows param names.
 */
const buildMarktplatzParams = (
  keyword: string,
  rows: number,
  page: number = 1,
  areaIds?: number[],
  filters?: MarktplatzFilters,
): URLSearchParams => {
  const params = new URLSearchParams({
    rows: String(rows),
    keyword,
    sort: '0',
  });
  if (page > 1) params.set('page', String(page));
  if (areaIds?.length) {
    for (const aid of areaIds) params.append('areaId', String(aid));
  }
  if (filters?.priceFrom !== undefined) params.set('PRICE_FROM', String(filters.priceFrom));
  if (filters?.priceTo !== undefined) params.set('PRICE_TO', String(filters.priceTo));
  if (filters?.condition) {
    const attrId = CONDITION_MAP[filters.condition];
    if (attrId) params.set('treeAttributes', attrId);
  }
  if (filters?.isPrivate !== undefined) params.set('ISPRIVATE', filters.isPrivate ? '1' : '0');
  if (filters?.shipping === true) params.append('treeAttributes', '2537');
  if (filters?.paylivery === true) params.set('paylivery', 'true');
  if (filters?.period !== undefined) params.set('periode', String(filters.period));
  return params;
};

/**
 * Fetch items via Marktplatz JSON Search API (/webapi/ad-search/).
 * Returns enriched Map<adId, Partial<Listing>>.
 */
export const fetchMarktplatzApi = async (
  keyword: string,
  vertical: MarktplatzVertical,
  areaIds?: number[],
  rows: number = 50,
  page: number = 1,
  filters?: MarktplatzFilters,
): Promise<{ items: Map<string, Partial<Listing>>; rowsFound: number }> => {
  try {
    const { csrfToken, cookieHeader } = await getVisitorCookies();
    const params = buildMarktplatzParams(keyword, rows, page, areaIds, filters);

    const url = `https://www.willhaben.at/webapi/ad-search/search/atz/${vertical.vertical}/${vertical.category}/atverz?${params}`;
    if (filters?.priceFrom !== undefined || filters?.priceTo !== undefined ||
        filters?.condition || filters?.isPrivate !== undefined ||
        filters?.paylivery || filters?.period !== undefined) {
      // Apply same filters to HTML URL for consistent results
    }

    const resp = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        "x-bbx-csrf-token": csrfToken,
        "x-wh-client": WH_CLIENT,
        Referer: "https://www.willhaben.at/",
        Cookie: cookieHeader,
      },
    });

    if (!resp.ok) return { items: new Map(), rowsFound: 0 };

    const data = await resp.json() as {
      advertSummary?: MarktplatzApiItem[];
      advertSummaryList?: { advertSummary?: MarktplatzApiItem[] };
      rowsFound?: number;
    };

    const items = data.advertSummary || data.advertSummaryList?.advertSummary || [];
    const result = new Map<string, Partial<Listing>>();

    for (const item of items) {
      const a = parseApiAttributes(item);

      const price = parsePrice(a["PRICE"] || a["PRICE_FOR_DISPLAY"]);
      const oldPrice = parsePrice(a["OLD_PRICE"] || a["OLD_PRICE_FOR_DISPLAY"]);
      const isPrivate = a["ISPRIVATE"] === "1";

      result.set(String(item.id), {
        id: String(item.id),
        title: typeof item.description === "string" ? item.description : "",
        price,
        priceText: a["PRICE_FOR_DISPLAY"] || (price !== null ? `€ ${price}` : ""),
        oldPrice,
        oldPriceText: a["OLD_PRICE_FOR_DISPLAY"] || (oldPrice !== null ? `€ ${oldPrice}` : undefined),
        isPrivate,
        coordinates: a["COORDINATES"],
        imageUrl: item.advertImageList?.advertImage?.[0]?.mainImageUrl,
        location: [a["POSTCODE"], a["LOCATION"]].filter(Boolean).join(", "),
        sellerId: a["ORGID"],
        sellerName: a["ORGNAME"] || a["CONTACT/NAME"] || "",
        paylivery: a["p2penabled"] === "true",
        publishedAt: a["PUBLISHED_String"],
        condition: a["CONDITION"] || "",
        // Immo fields (null for pure marktplatz)
        estateSize: parseEstateSize(a["ESTATE_SIZE"]),
        rooms: parseRooms(a["ROOMS"]),
        floor: a["FLOOR"] || undefined,
        propertyType: a["PROPERTY_TYPE"] || undefined,
        pricePerSqm: computePricePerSqm(price, parseEstateSize(a["ESTATE_SIZE"])),
      });
    }

    return { items: result, rowsFound: data.rowsFound || 0 };
  } catch {
    return { items: new Map(), rowsFound: 0 };
  }
};

// ─── Main Marktplatz Search ───────────────────────────────────────────────

/**
 * Search Marktplatz — hybrid approach: HTML scrape + JSON API enrichment.
 */
export const searchMarktplatz = async (
  keyword: string,
  verticalKey?: string,
  categoryId?: string,
  page: number = 1,
  areaIds?: number[],
  filters?: MarktplatzFilters,
  maxPages: number = 1,
): Promise<SearchResult> => {
  const vc = resolveMarktplatzVertical(verticalKey);
  const { cookies } = await checkAuth();
  const headers = getHeaders(cookies);

  let url = `${BASE_URL}/iad/${vc.htmlPath}?keyword=${encodeURIComponent(keyword)}&page=${page}`;
  if (categoryId) url += `&ATTRIBUTE_TREE=${categoryId}`;
  if (areaIds?.length) for (const aid of areaIds) url += `&areaId=${aid}`;

  // Apply price filters to HTML URL too (for consistent totalFound)
  if (filters?.priceFrom !== undefined) url += `&PRICE_FROM=${filters.priceFrom}`;
  if (filters?.priceTo !== undefined) url += `&PRICE_TO=${filters.priceTo}`;
  if (filters?.condition) {
    const attrId = CONDITION_MAP[filters.condition];
    if (attrId) url += `&treeAttributes=${attrId}`;
  }
  if (filters?.isPrivate !== undefined) url += `&ISPRIVATE=${filters.isPrivate ? '1' : '0'}`;

  // Page 1: HTML scrape (categories + totalFound) + JSON API in parallel
  const [htmlResponse, apiResult] = await Promise.all([
    fetch(url, { headers }).then(async r => {
      if (!r.ok) throw new Error(`Search failed with status: ${r.status}`);
      return r.text();
    }),
    fetchMarktplatzApi(keyword, vc, areaIds, 50, 1, filters),
  ]);

  const $ = load(htmlResponse);
  const nextData = $("#__NEXT_DATA__").html();
  if (!nextData) throw new Error("Could not find data on page (missing __NEXT_DATA__)");

  const data = JSON.parse(nextData);
  const searchResult = data.props?.pageProps?.searchResult;
  const categorySuggestionsData = data.props?.pageProps?.categorySuggestions || [];

  if (!searchResult) return { items: [], totalFound: 0, categories: [] };

  const ads = searchResult.advertSummaryList?.advertSummary || [];
  const totalFound = searchResult.rowsFound || ads.length;
  const htmlItems = ads.map(parseListing);

  // Merge page 1: prefer API items (richer data), fill gaps with HTML items
  const items: Listing[] = [];
  const seen = new Set<string>();
  mergeApiItems(apiResult.items, items, seen);
  mergeHtmlItems(htmlItems, items, seen);

  // Fetch additional pages (API only — no HTML needed for categories)
  const perPage = 50;
  const pagesNeeded = Math.min(maxPages, Math.ceil(totalFound / perPage));
  if (pagesNeeded > 1) {
    const extraPages = Array.from({ length: pagesNeeded - 1 }, (_, i) => i + 2);
    const extraResults = await Promise.all(
      extraPages.map(p => fetchMarktplatzApi(keyword, vc, areaIds, perPage, p, filters))
    );
    for (const res of extraResults) {
      mergeApiItems(res.items, items, seen);
    }
  }

  // Extract categories
  let categories: CategorySuggestion[] = extractCategories(searchResult, categorySuggestionsData);
  categories.sort((a, b) => b.count - a.count);

  return { items, totalFound, categories };
};

// ─── Merge helpers ───────────────────────────────────────────────────────

function mergeApiItems(
  apiItems: Map<string, Partial<Listing>>,
  items: Listing[],
  seen: Set<string>,
): void {
  for (const [, apiItem] of apiItems) {
    if (apiItem.id && !seen.has(apiItem.id)) {
      items.push({
        id: apiItem.id,
        title: apiItem.title || "",
        price: apiItem.price ?? null,
        priceText: apiItem.priceText || "",
        oldPrice: apiItem.oldPrice ?? null,
        oldPriceText: apiItem.oldPriceText,
        location: apiItem.location || "",
        description: "",
        url: `${BASE_URL}/iad/object?adId=${apiItem.id}`,
        imageUrl: apiItem.imageUrl,
        isPrivate: apiItem.isPrivate,
        coordinates: apiItem.coordinates,
        sellerId: apiItem.sellerId,
        sellerName: apiItem.sellerName || "",
        publishedAt: apiItem.publishedAt,
        condition: apiItem.condition || "",
        paylivery: apiItem.paylivery ?? false,
        estateSize: apiItem.estateSize ?? null,
        rooms: apiItem.rooms ?? null,
        floor: apiItem.floor ?? null,
        propertyType: apiItem.propertyType ?? null,
        pricePerSqm: apiItem.pricePerSqm ?? null,
      });
      seen.add(apiItem.id!);
    }
  }
}

function mergeHtmlItems(htmlItems: Listing[], items: Listing[], seen: Set<string>): void {
  for (const item of htmlItems) {
    if (!seen.has(item.id)) {
      items.push(item);
      seen.add(item.id);
    }
  }
}

// ─── Category Extraction ─────────────────────────────────────────────────

function extractCategories(
  searchResult: any,
  categorySuggestionsData: any[],
): CategorySuggestion[] {
  let categories: CategorySuggestion[] = [];

  if (searchResult.navigatorGroups) {
    const isCatGroup = (g: any) =>
      ["attribute_tree", "ATTRIBUTE_TREE", "category"].includes(g.id) ||
      g.label === "Kategorie";

    let catGroup = searchResult.navigatorGroups.find(isCatGroup);
    if (!catGroup) {
      for (const group of searchResult.navigatorGroups) {
        if (group.navigatorList) {
          const found = group.navigatorList.find(isCatGroup);
          if (found) { catGroup = found; break; }
        }
      }
    }

    if (catGroup?.values) {
      categories = catGroup.values.map((v: any) => ({
        id: v.value, name: v.label, count: v.hits || 0,
      }));
    } else if (catGroup?.groupedPossibleValues?.[0]?.possibleValues) {
      categories = catGroup.groupedPossibleValues[0].possibleValues
        .map((v: any) => ({
          id: v.urlParamRepresentationForValue?.find(
            (p: any) => p.urlParameterName === "ATTRIBUTE_TREE"
          )?.value,
          name: v.label,
          count: v.hits || 0,
        }))
        .filter((c: any) => c.id);
    }
  }

  if (categories.length === 0 && categorySuggestionsData.length > 0) {
    categories = categorySuggestionsData.map((c: any) => ({
      id: c.id, name: c.name, count: c.count || 0,
    }));
  }

  return categories;
}

// ─── Category Tree ───────────────────────────────────────────────────────

export const getMarktplatzCategoryTree = async (
  categoryId?: string,
  keyword?: string,
): Promise<CategoryTree> => {
  const { cookies } = await checkAuth();
  const headers = getHeaders(cookies);

  let url = `${BASE_URL}/iad/kaufen-und-verkaufen/marktplatz?page=1`;
  if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
  if (categoryId) url += `&ATTRIBUTE_TREE=${categoryId}`;

  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Failed to fetch categories: ${response.status}`);

  const html = await response.text();
  const $ = load(html);
  const nextData = $("#__NEXT_DATA__").html();
  if (!nextData) throw new Error("Missing __NEXT_DATA__");

  const data = JSON.parse(nextData);
  const searchResult = data.props?.pageProps?.searchResult;
  const catSuggestions = data.props?.pageProps?.categorySuggestions || [];

  const children: CategoryNode[] = [];
  // Reuse same extraction logic
  const cats = extractCategories(searchResult, catSuggestions);
  for (const c of cats) {
    children.push({ id: c.id, name: c.name, count: c.count });
  }

  let categoryName: string | undefined;
  if (categoryId && searchResult?.selectedNavigators) {
    const selected = searchResult.selectedNavigators.find(
      (n: any) => n.name === "ATTRIBUTE_TREE"
    );
    if (selected?.values?.[0]?.label) categoryName = selected.values[0].label;
  }

  return { categoryId, categoryName, children };
};

// ─── Listing Details (shared by both domains) ───────────────────────────

export const getListingDetails = async (adId: string) => {
  const { cookies } = await checkAuth();
  const headers = getHeaders(cookies);
  const url = `${BASE_URL}/iad/object?adId=${adId}`;

  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Failed to fetch listing: ${response.status}`);

  const html = await response.text();
  const $ = load(html);
  const nextData = $("#__NEXT_DATA__").html();
  if (!nextData) throw new Error("Missing __NEXT_DATA__");

  const data = JSON.parse(nextData);
  const adData = data.props?.pageProps?.advertDetails;
  if (!adData) throw new Error("Advert details not found");

  const basicListing = parseListing(adData);
  const attributes = parseAttributes(adData);

  const rawImages = adData.images || [];
  const images = rawImages
    .map((img: any) => {
      if (typeof img === "string") return img;
      return img?.mainImageUrl || img?.url || img?.src || null;
    })
    .filter(Boolean);

  const fallbackImages = images.length > 0 ? [] :
    [...(html.match(/https:\/\/cache\.willhaben\.at\/mmo\/[^"]+\.(jpg|png|webp)/gi) || [])]
      .filter(u => !u.includes("campaigns") && !u.includes("/img/delivery"));

  return {
    ...basicListing,
    fullDescription: adData.body || attributes["DESCRIPTION"]?.[0] || "",
    images: images.length > 0 ? images : fallbackImages,
    attributes,
    phone: attributes["PHONE"]?.[0],
    views: undefined,
  };
};

// ─── Seller Info ─────────────────────────────────────────────────────────

export const getSeller = async (userId: string): Promise<Seller> => {
  const { cookies } = await checkAuth();
  const headers = getHeaders(cookies);
  const url = `https://publicapi.willhaben.at/userprofile/trust-signals/${userId}`;

  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Failed to fetch seller: ${response.status}`);

  const data = await response.json();
  return {
    id: userId,
    name: data.userName || "",
    rating: data.rating?.averageRating,
    ratingCount: data.rating?.ratingCount || 0,
    responseTime: data.responseTime?.label || "",
    verified: data.verificationStatus?.verified || false,
    professional: data.userType === "PROFESSIONAL",
    location: data.location || "",
  };
};

// ─── Images (shared by both domains) ─────────────────────────────────────

export interface ListingImage {
  url: string;
  width: number;
  height: number;
}

export interface ListingWithImages {
  id: string;
  title: string;
  priceText: string;
  price: number | null;
  location: string;
  isPrivate: boolean;
  isDealer: boolean;
  description: string;
  images: ListingImage[];
  imageCount: number;
}

export const getListingImages = async (adId: string): Promise<ListingWithImages> => {
  const url = `${BASE_URL}/iad/object?adId=${adId}`;
  const userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

  const resp = await fetch(url, {
    headers: { "User-Agent": userAgent },
    redirect: "follow",
  });
  const html = await resp.text();

  if (!html.includes("__NEXT_DATA__")) {
    throw new Error(`Failed to load listing ${adId}: no __NEXT_DATA__ (status=${resp.status})`);
  }

  const $ = load(html);
  const nextData = $("#__NEXT_DATA__").html();
  if (!nextData) throw new Error("Missing __NEXT_DATA__");

  const data = JSON.parse(nextData);
  const adData = data.props?.pageProps?.advertDetails;
  if (!adData) throw new Error("Advert details not found");

  const basicListing = parseListing(adData);
  const attrs = parseAttributes(adData);

  // Extract all cache.willhaben.at image URLs from raw HTML
  const allMatches = html.match(/https:\/\/cache\.willhaben\.at\/mmo\/[^"]+\.(jpg|png|webp)/gi) || [];
  const allUrls = [...new Set(allMatches)];

  const productUrls = allUrls.filter(u =>
    !u.includes("campaigns") &&
    !u.includes("/img/delivery") &&
    !u.includes("userProfile") &&
    u.includes("mmo/")
  );

  // Prefer _hoved (largest) per unique photo
  const photoMap = new Map<string, string>();
  for (const url of productUrls) {
    const match = url.match(/^(.+?)(?:_thumb|_hoved)?\.jpg$/);
    if (!match) continue;
    const [, base] = match;
    const existing = photoMap.get(base);
    if (!existing || url.includes("_hoved")) {
      photoMap.set(base, url.includes("_hoved") ? url : base + "_hoved.jpg");
    }
  }

  const allImages: ListingImage[] = Array.from(photoMap.values()).map(url => ({
    url, width: 942, height: 1200,
  }));

  return {
    id: adId,
    title: basicListing.title,
    priceText: basicListing.priceText || "",
    price: basicListing.price,
    location: attrs["LOCATION/ADDRESS_2"]?.[0] || attrs["LOCATION/ADDRESS_1"]?.[0] || "",
    isPrivate: attrs.ISPRIVATE?.[0] === "1",
    isDealer: attrs.DEALER?.[0] === "1",
    description: adData.body || attrs.DESCRIPTION?.[0] || "",
    images: allImages,
    imageCount: allImages.length,
  };
};
