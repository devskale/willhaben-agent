import { checkAuth, getVisitorCookies } from "./auth.js";
import { load } from "cheerio";
import {
  Listing,
  ListingDetail,
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

const getHeaders = (cookies: string) => ({
  "User-Agent": UA,
  Cookie: cookies,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "de-AT,de;q=0.9,en;q=0.8",
});

const parseAttributes = (item: any): Record<string, any> => {
  const attrsData = item.attributes || {};
  let attrsList = [];

  if (Array.isArray(attrsData)) {
    attrsList = attrsData;
  } else if (attrsData.attribute) {
    attrsList = attrsData.attribute;
  }

  const attributes: Record<string, any> = {};
  for (const attr of attrsList) {
    if (attr.name) {
      attributes[attr.name] = attr.values || [];
    }
  }
  return attributes;
};

const parseListing = (item: any): Listing => {
  const attributes = parseAttributes(item);

  // Price extraction
  let price: number | null = null;
  let priceText = "";

  if (attributes["PRICE_FOR_DISPLAY"] && attributes["PRICE_FOR_DISPLAY"][0]) {
    priceText = attributes["PRICE_FOR_DISPLAY"][0];
  }

  if (attributes["PRICE/AMOUNT"] && attributes["PRICE/AMOUNT"][0]) {
    try {
      price = parseFloat(attributes["PRICE/AMOUNT"][0]);
      if (!priceText) {
        priceText = `€ ${price.toLocaleString("de-AT", { minimumFractionDigits: 2 })}`;
      }
    } catch {
      // Ignore parsing errors
    }
  } else if (attributes["PRICE"] && attributes["PRICE"][0]) {
    try {
      price = parseFloat(attributes["PRICE"][0]);
      if (!priceText) {
        priceText = `€ ${price.toLocaleString("de-AT", { minimumFractionDigits: 2 })}`;
      }
    } catch {
      // Ignore parsing errors
    }
  }

  // Location
  const locationParts = [];
  if (attributes["POSTCODE"]) locationParts.push(...attributes["POSTCODE"]);
  if (attributes["LOCATION"]) locationParts.push(...attributes["LOCATION"]);
  const location = locationParts.join(", ");

  const title =
    typeof item.description === "string"
      ? item.description
      : item.description?.header || "No Title";

  const description = item.body || "";

  return {
    id: item.id,
    title,
    price,
    priceText,
    location,
    description,
    url: `${BASE_URL}/iad/object?adId=${item.id}`,
    imageUrl:
      item.mainImageUrl || item.advertImageList?.advertImage?.[0]?.mainImageUrl,
    sellerId: attributes["SELLER_ID"]?.[0],
    sellerName: attributes["SELLER_NAME"]?.[0] || "",
    publishedAt: undefined, // Date parsing omitted for brevity
    condition: attributes["CONDITION"]?.[0] || "",
    paylivery: !!attributes["PAYLIVERY"],
    estateSize: null,
    rooms: null,
    floor: null,
    propertyType: null,
    pricePerSqm: null,
  };
};

interface ApiItem {
  id: number;
  description: string;
  attributes: { attribute: Array<{ name: string; values: string[] }> };
  advertImageList?: {
    advertImage?: Array<{ mainImageUrl?: string }>;
  };
}

/**
 * Parse attribute list from JSON API item into a flat map.
 */
const parseApiAttributes = (item: ApiItem): Record<string, string> => {
  const attrs: Record<string, string> = {};
  const list = item.attributes?.attribute || [];
  for (const a of list) {
    if (a.name && a.values?.[0] !== undefined) {
      attrs[a.name] = a.values[0];
    }
  }
  return attrs;
};

/**
 * Fetch items via JSON Search API (visitor cookies, no login needed).
 * Returns a map of adId → enriched Listing data.
 */
/** Server-side filter params for Immobilien API */
export interface ImmoFilters {
  priceFrom?: number;
  priceTo?: number;
  estateSizeFrom?: number;
  estateSizeTo?: number;
  rooms?: number;           // exact room count → NO_OF_ROOMS_BUCKET=NxN
  propertyType?: string;   // PROPERTY_TYPE ID (e.g. "101" for Maisonette)
}

/** Map friendly type names to searchIds for server-side filtering */
export const IMMO_TYPE_MAP: Record<string, number> = {
  alle: 90,
  wohnung: 101,       // Wohnung kaufen
  eigentumswohnung: 101,
  mietwohnung: 131,   // Wohnung mieten
  haus: 102,          // Haus kaufen
  mieethaus: 132,     // Haus mieten
  grundstück: 14,
  grundstueck: 14,
  gewerbe: 15,        // Gewerbe kaufen
  gewerbe_mieten: 16,
  ferien: 12,         // Ferienimmobilie kaufen
  ferien_mieten: 32,
  neubau: 42,
  sonstige: 35,
};

const VERTICAL_CATEGORIES: Record<string, { vertical: number; category: string; htmlPath: string; searchId?: number }> = {
  marktplatz: { vertical: 5, category: "301", htmlPath: "kaufen-und-verkaufen/marktplatz" },
  immobilien: { vertical: 2, category: "100", htmlPath: "immobilien", searchId: 90 },
  wohnungen: { vertical: 2, category: "101", htmlPath: "immobilien/eigentumswohnung/eigentumswohnung-angebote", searchId: 101 },
  hauser: { vertical: 2, category: "102", htmlPath: "immobilien/haus/haus-angebote", searchId: 102 },
  auto: { vertical: 3, category: "101", htmlPath: "auto/motorwagen" },
};

type VerticalKey = keyof typeof VERTICAL_CATEGORIES;

const resolveVertical = (v?: string): { vertical: number; category: string; htmlPath: string; searchId?: number } =>
  VERTICAL_CATEGORIES[(v || "marktplatz") as VerticalKey] || VERTICAL_CATEGORIES.marktplatz;

/**
 * Search immobilien via /webapi/iad/search/atz/2/{searchId}?areaId=...
 * This is a completely different API from Marktplatz — different endpoint,
 * different attribute names (ESTATE_SIZE/LIVING_AREA, NUMBER_OF_ROOMS vs ROOMS,
 * ESTATE_PRICE/PRICE_SUGGESTION vs PRICE). Uses searchId not vertical/category.
 */
const searchImmoApi = async (
  searchId: number,
  areaIds?: number[],
  rows: number = 30,
  filters?: ImmoFilters,
): Promise<{ items: Map<string, Partial<Listing>>; totalFound: number }> => {
  try {
    const { csrfToken, cookieHeader } = await getVisitorCookies();

    const params = new URLSearchParams({
      rows: String(rows),
      isNavigation: "true",
      page: "1",
    });
    if (areaIds?.length) {
      for (const aid of areaIds) {
        params.append("areaId", String(aid));
      }
    }

    // Server-side filter params (validated via Chrome DevTools inspection)
    if (filters?.priceFrom) params.set("PRICE_FROM", String(filters.priceFrom));
    if (filters?.priceTo) params.set("PRICE_TO", String(filters.priceTo));
    if (filters?.estateSizeFrom) params.set("ESTATE_SIZE/LIVING_AREA_FROM", String(filters.estateSizeFrom));
    if (filters?.estateSizeTo) params.set("ESTATE_SIZE/LIVING_AREA_TO", String(filters.estateSizeTo));
    if (filters?.rooms) params.set("NO_OF_ROOMS_BUCKET", `${filters.rooms}X${filters.rooms}`);
    if (filters?.propertyType) params.set("PROPERTY_TYPE", filters.propertyType);

    const url = `https://www.willhaben.at/webapi/iad/search/atz/2/${searchId}?${params}`;

    const resp = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        "x-bbx-csrf-token": csrfToken,
        "x-wh-client": WH_CLIENT,
        Referer: "https://www.willhaben.at/iad/immobilien",
        Cookie: cookieHeader,
      },
    });

    if (!resp.ok) return { items: new Map(), totalFound: 0 };

    const data = await resp.json() as { advertSummary?: ApiItem[]; advertSummaryList?: { advertSummary?: ApiItem[] }; rowsFound?: number };
    const items = data.advertSummary || data.advertSummaryList?.advertSummary || [];
    const result = new Map<string, Partial<Listing>>();

    for (const item of items) {
      const a = parseApiAttributes(item);

      // Immobiliens uses ESTATE_PRICE/PRICE_SUGGESTION (not PRICE)
      const rawPrice = a["PRICE"] || a["ESTATE_PRICE/PRICE_SUGGESTION"] || a["PRICE_FOR_DISPLAY"];
      const price = parsePrice(rawPrice);
      const oldPrice = parsePrice(a["OLD_PRICE"] || a["OLD_PRICE_FOR_DISPLAY"]);
      const isPrivate = a["ISPRIVATE"] === "1";
      const imageUrl = item.advertImageList?.advertImage?.[0]?.mainImageUrl;

      // Immobiliens uses ESTATE_SIZE/LIVING_AREA or PLOT/AREA (not plain ESTATE_SIZE)
      const rawSize = a["ESTATE_SIZE"] || a["ESTATE_SIZE/LIVING_AREA"] || a["PLOT/AREA"];
      const estateSize = parseEstateSize(rawSize);

      // Immobiliens uses NUMBER_OF_ROOMS (e.g. "7") not ROOMS (e.g. "3X3")")
      const rawRooms = a["NUMBER_OF_ROOMS"] || a["ROOMS"];
      const rooms = parseRooms(rawRooms);

      const floor = a["FLOOR"] || undefined;
      const propertyType = a["PROPERTY_TYPE"] || undefined;
      const pricePerSqm = computePricePerSqm(price, estateSize);

      result.set(String(item.id), {
        id: String(item.id),
        title: typeof item.description === 'string' ? item.description : '',
        price,
        priceText: a["PRICE_FOR_DISPLAY"] || (price !== null ? `€ ${price}` : ""),
        oldPrice,
        oldPriceText: a["OLD_PRICE_FOR_DISPLAY"] || (oldPrice !== null ? `€ ${oldPrice}` : undefined),
        isPrivate,
        coordinates: a["COORDINATES"],
        imageUrl,
        location: [a["POSTCODE"], a["LOCATION"]].filter(Boolean).join(", "),
        sellerId: a["ORGID"],
        sellerName: a["ORGNAME"] || a["CONTACT/NAME"] || "",
        paylivery: a["p2penabled"] === "true",
        publishedAt: a["PUBLISHED_String"],
        condition: a["CONDITION"] || "",
        estateSize,
        rooms,
        floor,
        propertyType,
        pricePerSqm,
      });
    }

    return { items: result, totalFound: (typeof data.rowsFound === 'number' ? data.rowsFound : items.length) };
  } catch {
    return { items: new Map(), totalFound: 0 };
  }
};

const searchItemsApi = async (
  keyword: string,
  vertical: number,
  apiCategory: string,
  areaIds?: number[],
  rows: number = 50,
): Promise<Map<string, Partial<Listing>>> => {
  try {
    const { csrfToken, cookieHeader } = await getVisitorCookies();

    const params = new URLSearchParams({
      rows: String(rows),
      keyword,
      sort: "0",
    });
    if (areaIds?.length) {
      for (const aid of areaIds) {
        params.append("areaId", String(aid));
      }
    }

    const url = `https://www.willhaben.at/webapi/ad-search/search/atz/${vertical}/${apiCategory}/atverz?${params}`;

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

    if (!resp.ok) {
      return new Map(); // Graceful fallback — HTML results still work
    }

    const data = await resp.json() as { advertSummary?: ApiItem[]; advertSummaryList?: { advertSummary?: ApiItem[] }; rowsFound?: number };
    const items = data.advertSummary || data.advertSummaryList?.advertSummary || [];
    const result = new Map<string, Partial<Listing>>();

    for (const item of items) {
      const a = parseApiAttributes(item);

      // Price — use robust parser (handles "ab €", dots as thousands sep)
      const price = parsePrice(a["PRICE"] || a["PRICE_FOR_DISPLAY"]);
      const oldPrice = parsePrice(a["OLD_PRICE"] || a["OLD_PRICE_FOR_DISPLAY"]);
      const isPrivate = a["ISPRIVATE"] === "1";
      const imageUrl = item.advertImageList?.advertImage?.[0]?.mainImageUrl;

      // Immobilien-specific — robust parsing
      const estateSize = parseEstateSize(a["ESTATE_SIZE"]);
      const rooms = parseRooms(a["ROOMS"]);
      const floor = a["FLOOR"] || undefined;
      const propertyType = a["PROPERTY_TYPE"] || undefined;
      const pricePerSqm = computePricePerSqm(price, estateSize);

      result.set(String(item.id), {
        id: String(item.id),
        title: typeof item.description === 'string' ? item.description : '',
        price,
        priceText: a["PRICE_FOR_DISPLAY"] || (price !== null ? `€ ${price}` : ""),
        oldPrice,
        oldPriceText: a["OLD_PRICE_FOR_DISPLAY"] || (oldPrice !== null ? `€ ${oldPrice}` : undefined),
        isPrivate,
        coordinates: a["COORDINATES"],
        imageUrl,
        location: [a["POSTCODE"], a["LOCATION"]].filter(Boolean).join(", "),
        sellerId: a["ORGID"],
        sellerName: a["ORGNAME"] || a["CONTACT/NAME"] || "",
        paylivery: a["p2penabled"] === "true",
        publishedAt: a["PUBLISHED_String"],
        condition: a["CONDITION"] || "",
        // Immobilien fields
        estateSize,
        rooms,
        floor,
        propertyType,
        pricePerSqm,
      });
    }

    return result;
  } catch {
    return new Map(); // Graceful fallback
  }
};

export const searchItems = async (
  keyword: string,
  categoryId?: string,
  page: number = 1,
  areaIds?: number[],
  verticalKey?: string,
  immoFilters?: ImmoFilters,
  immoSearchId?: number,
): Promise<SearchResult> => {
  const vc = resolveVertical(verticalKey);
  const { cookies } = await checkAuth();
  const headers = getHeaders(cookies);

  let url = `${BASE_URL}/iad/${vc.htmlPath}?keyword=${encodeURIComponent(keyword)}&page=${page}`;
  if (categoryId) {
    url += `&ATTRIBUTE_TREE=${categoryId}`;
  }
  if (areaIds && areaIds.length > 0) {
    for (const areaId of areaIds) {
      url += `&areaId=${areaId}`;
    }
  }

  // Immobilien uses a completely different API — skip HTML scrape, use dedicated endpoint
  if ("searchId" in vc && vc.searchId) {
    const { items: apiData, totalFound: immoTotal } = await searchImmoApi(
      immoSearchId || Number(vc.searchId),
      areaIds,
      30,
      immoFilters,
    );
    const items: Listing[] = [];
    for (const [, apiItem] of apiData) {
      if (apiItem.id) {
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
      }
    }
    return { items, totalFound: immoTotal, categories: [] };
  }

  try {
    // Run HTML scrape + JSON API in parallel (hybrid approach)
    const [htmlResponse, apiData] = await Promise.all([
      fetch(url, { headers }).then(async r => {
        if (!r.ok) throw new Error(`Search failed with status: ${r.status}`);
        return r.text();
      }),
      searchItemsApi(keyword, vc.vertical, vc.category, areaIds),
    ]);

    const html = htmlResponse;
    const $ = load(html);
    const nextData = $("#__NEXT_DATA__").html();

    if (!nextData) {
      throw new Error("Could not find data on page (missing __NEXT_DATA__)");
    }

    const data = JSON.parse(nextData);
    const searchResult = data.props?.pageProps?.searchResult;
    const categorySuggestionsData =
      data.props?.pageProps?.categorySuggestions || [];

    if (!searchResult) {
      return { items: [], totalFound: 0, categories: [] };
    }

    const ads = searchResult.advertSummaryList?.advertSummary || [];
    const totalFound = searchResult.rowsFound || ads.length;
    const htmlItems = ads.map(parseListing);

    // Prefer API items (richer data: ISPRIVATE, OLD_PRICE, COORDINATES, etc.)
    // Fall back to HTML items for any IDs the API didn't return
    const items: Listing[] = [];
    const apiMap = apiData;
    const seen = new Set<string>();

    // Add all API items first (they have full enrichment)
    for (const [, apiItem] of apiMap) {
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

    // Add HTML items that the API didn't cover
    for (const item of htmlItems) {
      if (!seen.has(item.id)) {
        items.push(item);
        seen.add(item.id);
      }
    }

    // Enrich remaining HTML items with any API data we have
    // (this handles the case where API items have different IDs but we still have partial overlap)

    // Extract categories
    let categories: CategorySuggestion[] = [];

    if (searchResult.navigatorGroups) {
      const isCategoryGroup = (g: any) =>
        g.id === "attribute_tree" ||
        g.name === "ATTRIBUTE_TREE" ||
        g.id === "category" ||
        g.label === "Kategorie";

      let categoryGroup = searchResult.navigatorGroups.find(isCategoryGroup);

      // If not found, try nested navigatorList
      if (!categoryGroup) {
        for (const group of searchResult.navigatorGroups) {
          if (group.navigatorList) {
            const found = group.navigatorList.find(isCategoryGroup);
            if (found) {
              categoryGroup = found;
              break;
            }
          }
        }
      }

      if (categoryGroup) {
        // Handle both flat values and groupedPossibleValues
        if (categoryGroup.values) {
          categories = categoryGroup.values.map((val: any) => ({
            id: val.value,
            name: val.label,
            count: val.hits || 0,
          }));
        } else if (categoryGroup.groupedPossibleValues?.[0]?.possibleValues) {
          categories = categoryGroup.groupedPossibleValues[0].possibleValues
            .map((val: any) => ({
              id: val.urlParamRepresentationForValue?.find(
                (p: any) => p.urlParameterName === "ATTRIBUTE_TREE"
              )?.value,
              name: val.label,
              count: val.hits || 0,
            }))
            .filter((c: any) => c.id); // Ensure we have an ID
        }
      }
    }

    if (categories.length === 0 && categorySuggestionsData.length > 0) {
      categories = categorySuggestionsData.map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        count: cat.count || 0,
      }));
    }

    categories.sort((a, b) => b.count - a.count);

    return { items, totalFound, categories };
  } catch (error) {
    console.error("Search error:", error);
    throw error;
  }
};

export const getCategoryTree = async (
  categoryId?: string,
  keyword?: string
): Promise<CategoryTree> => {
  const { cookies } = await checkAuth();
  const headers = getHeaders(cookies);

  // Build URL - use a broad search to get category structure
  let url = `${BASE_URL}/iad/kaufen-und-verkaufen/marktplatz?page=1`;
  if (keyword) {
    url += `&keyword=${encodeURIComponent(keyword)}`;
  }
  if (categoryId) {
    url += `&ATTRIBUTE_TREE=${categoryId}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch categories: ${response.status}`);
  }

  const html = await response.text();
  const $ = load(html);
  const nextData = $("#__NEXT_DATA__").html();

  if (!nextData) {
    throw new Error("Missing __NEXT_DATA__");
  }

  const data = JSON.parse(nextData);
  const searchResult = data.props?.pageProps?.searchResult;
  const categorySuggestionsData = data.props?.pageProps?.categorySuggestions || [];

  const children: CategoryNode[] = [];

  if (searchResult?.navigatorGroups) {
    const isCategoryGroup = (g: any) =>
      g.id === "attribute_tree" ||
      g.name === "ATTRIBUTE_TREE" ||
      g.id === "category" ||
      g.label === "Kategorie";

    let categoryGroup = searchResult.navigatorGroups.find(isCategoryGroup);

    // If not found, try nested navigatorList
    if (!categoryGroup) {
      for (const group of searchResult.navigatorGroups) {
        if (group.navigatorList) {
          const found = group.navigatorList.find(isCategoryGroup);
          if (found) {
            categoryGroup = found;
            break;
          }
        }
      }
    }

    if (categoryGroup) {
      if (categoryGroup.values) {
        for (const val of categoryGroup.values) {
          children.push({
            id: val.value,
            name: val.label,
            count: val.hits || 0,
          });
        }
      } else if (categoryGroup.groupedPossibleValues?.[0]?.possibleValues) {
        for (const val of categoryGroup.groupedPossibleValues[0].possibleValues) {
          const id = val.urlParamRepresentationForValue?.find(
            (p: any) => p.urlParameterName === "ATTRIBUTE_TREE"
          )?.value;
          if (id) {
            children.push({
              id,
              name: val.label,
              count: val.hits || 0,
            });
          }
        }
      }
    }
  }

  // Fallback to categorySuggestions if no navigator groups
  if (children.length === 0 && categorySuggestionsData.length > 0) {
    for (const cat of categorySuggestionsData) {
      children.push({
        id: String(cat.id),
        name: cat.name,
        count: cat.count || 0,
      });
    }
  }

  // Sort by count descending
  children.sort((a, b) => (b.count || 0) - (a.count || 0));

  // Try to get the current category name from the response
  let categoryName: string | undefined;
  if (categoryId && searchResult?.selectedNavigators) {
    const selected = searchResult.selectedNavigators.find(
      (n: any) => n.name === "ATTRIBUTE_TREE"
    );
    if (selected?.values?.[0]?.label) {
      categoryName = selected.values[0].label;
    }
  }

  return {
    categoryId,
    categoryName,
    children,
  };
};

export const getListingDetails = async (
  adId: string
): Promise<ListingDetail> => {
  const { cookies } = await checkAuth();
  const headers = getHeaders(cookies);
  const url = `${BASE_URL}/iad/object?adId=${adId}`;

  const response = await fetch(url, { headers });
  if (!response.ok)
    throw new Error(`Failed to fetch listing: ${response.status}`);

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

  // Fallback: extract cache URLs from HTML
  const fallbackImages = images.length > 0 ? [] :
    [...(html.match(/https:\/\/cache\.willhaben\.at\/mmo\/[^"]+\.(jpg|png|webp)/gi) || [])]
      .filter(u => !u.includes("campaigns") && !u.includes("/img/delivery"));

  return {
    ...basicListing,
    fullDescription: adData.body || "",
    images: images.length > 0 ? images : fallbackImages,
    attributes,
    phone: attributes["PHONE"]?.[0],
    views: undefined,
  };
};

export const getSeller = async (userId: string): Promise<Seller> => {
  const { cookies } = await checkAuth();
  const headers = getHeaders(cookies);
  const url = `https://publicapi.willhaben.at/userprofile/trust-signals/${userId}`;

  const response = await fetch(url, { headers });
  if (!response.ok)
    throw new Error(`Failed to fetch seller: ${response.status}`);

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

/**
 * Fetch listing details with image URLs extracted from HTML.
 * Works with public (no-login) and authenticated requests.
 */
export const getListingImages = async (adId: string): Promise<ListingWithImages> => {
  const url = `${BASE_URL}/iad/object?adId=${adId}`;
  
  const userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
  let html: string;
  
  const resp = await fetch(url, {
    headers: { "User-Agent": userAgent },
    redirect: "follow",
  });
  html = await resp.text();

  if (!html.includes("__NEXT_DATA__")) {
    throw new Error(`Failed to load listing ${adId}: page has no __NEXT_DATA__ (status=${resp.status})`);
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
  const allUrls = [...new Set(allMatches)]; // dedupe

  // Filter: remove UI icons, campaign banners, seller avatars
  const productUrls = allUrls.filter(u =>
    !u.includes("campaigns") &&
    !u.includes("/img/delivery") &&
    !u.includes("userProfile") &&
    u.includes("mmo/")
  );

  // Each photo has 3 size variants: original, _thumb, _hoved
  // For --all-images: keep only _hoved (largest) per unique photo
  const photoMap = new Map<string, string>(); // hash -> best URL
  for (const url of productUrls) {
    // Extract base: remove size suffix but keep the unique photo hash
    const match = url.match(/^(.+?)(?:_thumb|_hoved)?\.jpg$/);
    if (!match) continue;
    const [_, base] = match;
    // Prefer _hoved > original > thumb
    const existing = photoMap.get(base);
    if (!existing || url.includes("_hoved")) {
      photoMap.set(base, url.includes("_hoved") ? url : base + "_hoved.jpg");
    }
  }
  
  const allImages: ListingImage[] = Array.from(photoMap.values()).map(url => ({
    url,
    width: 942,
    height: 1200,
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
};;
