/**
 * Similar listings / recommendations ("Ähnliche Anzeigen").
 *
 * Uses the recommendation API to find similar ads for a given listing.
 * Gets orgId by searching for the specific adId (faster than detail page).
 */

import { getVisitorCookies } from "./auth.js";

const WH_CLIENT = "api@willhaben.at;responsive_web;server;1.0.0;desktop";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface SimilarListing {
  id: string;
  title: string;
  price: number | null;
  priceText: string;
  location: string;
  imageUrl: string;
  url: string;
}

export interface SimilarListingsResult {
  items: SimilarListing[];
  totalFound: number;
  heading: string;
}

/**
 * Get orgId for an adId by searching for it (fast, uses the same search API).
 */
async function getOrgId(adId: string): Promise<string | null> {
  const { csrfToken, cookieHeader } = await getVisitorCookies();

  // Search for this specific adId to get its orgId from search results
  // Try marktplatz first (most ads are there)
  let url = `https://www.willhaben.at/webapi/ad-search/search/atz/5/301/atverz?rows=3&keyword=${adId}`;
  
  const resp = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      "x-bbx-csrf-token": csrfToken,
      "x-wh-client": WH_CLIENT,
      Cookie: cookieHeader,
    },
  });

  if (!resp.ok) return null;

  const data = await resp.json() as any;
  const items = data.advertSummary || data.advertSummaryList?.advertSummary || [];

  for (const item of items) {
    if (String(item.id) === adId) {
      const attrs: Record<string, string[]> = {};
      for (const a of item.attributes?.attribute || []) attrs[a.name] = a.values || [];
      if (attrs["ORGID"]?.[0]) return attrs["ORGID"][0];
      if (attrs["ORG_UUID"]?.[0]) return attrs["ORG_UUID"][0];
    }
  }

  // Fallback: try vehicle vertical
  url = `https://www.willhaben.at/webapi/ad-search/search/atz/3/2/atverz?rows=3&keyword=${adId}`;
  const resp2 = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      "x-bbx-csrf-token": csrfToken,
      "x-wh-client": WH_CLIENT,
      Cookie: cookieHeader,
    },
  });

  if (!resp2.ok) return null;

  const data2 = await resp2.json() as any;
  const items2 = data2.advertSummary || data2.advertSummaryList?.advertSummary || [];

  for (const item of items2) {
    if (String(item.id) === adId) {
      const attrs: Record<string, string[]> = {};
      for (const a of item.attributes?.attribute || []) attrs[a.name] = a.values || [];
      if (attrs["ORGID"]?.[0]) return attrs["ORGID"][0];
      if (attrs["ORG_UUID"]?.[0]) return attrs["ORG_UUID"][0];
    }
  }

  return null;
}

/**
 * Find similar listings for a given ad.
 */
export async function getSimilarListings(
  adId: string,
  rows: number = 10,
): Promise<SimilarListingsResult> {
  const { csrfToken, cookieHeader } = await getVisitorCookies();

  // Step 1: Get orgId from the ad
  const orgId = await getOrgId(adId);
  if (!orgId) {
    throw new Error(`Could not determine orgId for ad ${adId}. The ad might not be indexed or belongs to a removed seller.`);
  }

  // Step 2: Call recommendation API
  const url = `https://api.willhaben.at/restapi/v2/recommendation/search/${adId}/${orgId}?absoluteImageUrls=true`;

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
    throw new Error(`Recommendation API failed: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json() as any;
  const items = data.advertSummaryList?.advertSummary || [];

  const listings: SimilarListing[] = items.map((item: any) => {
    const attrs: Record<string, string[]> = {};
    for (const a of item.attributes?.attribute || []) {
      attrs[a.name] = a.values || [];
    }

    const getValue = (name: string) => attrs[name]?.[0] || "";

    return {
      id: String(item.id),
      title: getValue("HEADING") || item.description || "",
      price: parseFloat(getValue("PRICE")) || null,
      priceText: getValue("PRICE_FOR_DISPLAY") || "",
      location: [getValue("POSTCODE"), getValue("LOCATION")].filter(Boolean).join(", "),
      imageUrl: item.advertImageList?.advertImage?.[0]?.mainImageUrl || "",
      url: `https://www.willhaben.at/iad/object?adId=${item.id}`,
    };
  });

  return {
    items: listings,
    totalFound: data.rowsFound || listings.length,
    heading: data.heading || "Ähnliche Anzeigen",
  };
}
