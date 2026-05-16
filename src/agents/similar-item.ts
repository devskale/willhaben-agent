/**
 * Item-based similar listings — content similarity via search API.
 *
 * Unlike seller-based recommendations (similar.ts), this finds listings
 * with similar attributes (same category, brand, price range) regardless of seller.
 *
 * Strategy:
 * 1. Fetch listing details to extract category, brand, model, price
 * 2. Search same category with price ±50% and brand filter
 * 3. Rank by attribute overlap and price proximity
 */

import { getVisitorCookies } from './auth.js';
import { getListingDetails } from './search-marktplatz.js';

import { WH_CLIENT, UA } from '../lib/constants.js';

export interface ItemSimilarListing {
  id: string;
  title: string;
  price: number | null;
  priceText: string;
  location: string;
  imageUrl: string;
  url: string;
  /** Similarity score 0-100 (higher = more similar) */
  score: number;
  /** How price compares: negative = cheaper, positive = more expensive */
  priceDiff: number | null;
}

export interface ItemSimilarResult {
  sourceId: string;
  sourceTitle: string;
  sourcePrice: number | null;
  items: ItemSimilarListing[];
  searchStrategy: string;
}

interface ListingProfile {
  adId: string;
  title: string;
  price: number | null;
  verticalId: number;
  adTypeId: number;
  productId: number;
  brand?: string;
  model?: string;
  condition?: string;
  postcode?: string;
  location?: string;
  attributes: Record<string, string[]>;
}

/**
 * Extract a listing profile from __NEXT_DATA__ advert details.
 */
async function getListingProfile(adId: string): Promise<ListingProfile> {
  const details = await getListingDetails(adId);
  const attrs = details.attributes || {};

  // Extract brand from various possible attribute names
  const brand =
    attrs['BRAND']?.[0] ||
    attrs['BRAND/FABRIKAT']?.[0] ||
    attrs['MANUFACTURER']?.[0] ||
    attrs['ANDERE_MODELLE']?.[0] ||  // Google -> "andere Modelle"
    '';

  const model =
    attrs['MODEL']?.[0] ||
    attrs['MODEL/TYPE']?.[0] ||
    attrs['CAR_MODEL/MODEL']?.[0] ||
    attrs['MC_MODEL/MODEL']?.[0] ||
    '';

  const condition =
    attrs['CONDITION']?.[0] ||
    attrs['ZUSTAND']?.[0] ||
    '';

  const price = details.price ?? null;

  // Get vertical/product info from __NEXT_DATA__ (exposed by getListingDetails)
  const verticalId = (details as any).verticalId ?? 5;
  const adTypeId = (details as any).adTypeId ?? 67;
  const productId = (details as any).productId ?? 67;

  return {
    adId,
    title: details.title || '',
    price,
    verticalId,
    adTypeId,
    productId,
    brand,
    model,
    condition,
    postcode: attrs['POSTCODE']?.[0] || attrs['PLZ']?.[0],
    location: attrs['LOCATION']?.[0],
    attributes: attrs,
  };
}

/**
 * Resolve the search category from the listing's SEO URL or product info.
 * 
 * The productId/adTypeId from __NEXT_DATA__ are NOT search categories.
 * We need to extract the search category from the SEO_URL breadcrumb.
 * Examples: "kaufen-und-verkaufen/d/pixel-4a-2097858592/" → we search category 2691 (Smartphones)
 */
function resolveSearchCategory(profile: ListingProfile): { vertical: number; category: string } {
  // For vehicles, use the searchId mapping
  if (profile.verticalId === 3) {
    // Map productId to searchId
    const vehicleMap: Record<number, string> = {
      40020: '2',   // Auto
      40021: '4',   // Motorrad
      40025: '50',  // Nutzfahrzeug
      40026: '52',  // Wohnwagen
    };
    return { vertical: 3, category: vehicleMap[profile.productId] || '2' };
  }
  
  // For marktplatz, the category from SEO URL or broad search
  // SEO_URL like "kaufen-und-verkaufen/d/..." → search in broad marktplatz (301)
  // The actual sub-category will be narrowed by the keyword
  return { vertical: profile.verticalId, category: '301' };
}

/**
 * Search for similar items using the ad-search API.
 */
async function searchSimilar(
  profile: ListingProfile,
  category: string,
  keyword: string,
  priceFrom?: number,
  priceTo?: number,
  rows: number = 20,
): Promise<ItemSimilarListing[]> {
  const { csrfToken, cookieHeader } = await getVisitorCookies();

  const params = new URLSearchParams({
    rows: String(rows),
    page: '1',
    keyword,
  });

  if (priceFrom !== undefined) params.set('price_from', String(Math.round(priceFrom)));
  if (priceTo !== undefined) params.set('price_to', String(Math.round(priceTo)));

  const url = `https://www.willhaben.at/webapi/ad-search/search/atz/${profile.verticalId}/${category}/atverz?${params}`;

  const resp = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
      'x-bbx-csrf-token': csrfToken,
      'x-wh-client': WH_CLIENT,
      Referer: 'https://www.willhaben.at/',
      Cookie: cookieHeader,
    },
  });

  if (!resp.ok) return [];

  const data = await resp.json() as any;
  const items = data.advertSummary || data.advertSummaryList?.advertSummary || [];

  const results: ItemSimilarListing[] = [];

  for (const item of items) {
    const id = String(item.id);
    if (id === profile.adId) continue; // skip self

    const attrs: Record<string, string[]> = {};
    for (const a of item.attributes?.attribute || []) {
      attrs[a.name] = a.values || [];
    }

    const getVal = (name: string) => attrs[name]?.[0] || '';
    const price = parseFloat(getVal('PRICE')) || null;
    const itemBrand = getVal('BRAND') || getVal('BRAND/FABRIKAT') || getVal('MANUFACTURER') || '';
    const itemModel = getVal('MODEL') || getVal('MODEL/TYPE') || '';
    const itemCondition = getVal('CONDITION') || getVal('ZUSTAND') || '';

    // Calculate similarity score
    let score = 0;

    // Brand match (big signal)
    if (profile.brand && itemBrand) {
      if (profile.brand.toLowerCase() === itemBrand.toLowerCase()) {
        score += 30;
      } else if (
        profile.brand.toLowerCase().includes(itemBrand.toLowerCase()) ||
        itemBrand.toLowerCase().includes(profile.brand.toLowerCase())
      ) {
        score += 15;
      }
    }

    // Model match
    if (profile.model && itemModel) {
      if (profile.model.toLowerCase() === itemModel.toLowerCase()) {
        score += 25;
      } else if (
        profile.model.toLowerCase().includes(itemModel.toLowerCase()) ||
        itemModel.toLowerCase().includes(profile.model.toLowerCase())
      ) {
        score += 15;
      }
    }

    // Price proximity (closer = better)
    if (profile.price !== null && price !== null) {
      const ratio = Math.abs(price - profile.price) / profile.price;
      if (ratio < 0.1) score += 20;      // within 10%
      else if (ratio < 0.25) score += 15; // within 25%
      else if (ratio < 0.5) score += 10;  // within 50%
      else score += 5;                     // beyond 50%
    }

    // Condition match
    if (profile.condition && itemCondition) {
      if (profile.condition.toLowerCase() === itemCondition.toLowerCase()) {
        score += 10;
      }
    }

    // Title keyword overlap
    const titleWords = (getVal('HEADING') || item.description || '').toLowerCase().split(/\s+/);
    const sourceWords = profile.title.toLowerCase().split(/\s+/);
    const overlap = titleWords.filter((w: string) => w.length > 2 && sourceWords.includes(w)).length;
    score += Math.min(overlap * 3, 15);

    const priceDiff = price !== null && profile.price !== null ? price - profile.price : null;

    results.push({
      id,
      title: getVal('HEADING') || item.description || '',
      price,
      priceText: getVal('PRICE_FOR_DISPLAY') || '',
      location: [getVal('POSTCODE'), getVal('LOCATION')].filter(Boolean).join(', '),
      imageUrl: item.advertImageList?.advertImage?.[0]?.mainImageUrl || '',
      url: `https://www.willhaben.at/iad/object?adId=${id}`,
      score,
      priceDiff,
    });
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}

/**
 * Find item-based similar listings for a given ad.
 *
 * Uses the listing's attributes to construct targeted searches:
 * 1. Same category + brand + price range
 * 2. Same category + keyword from title
 */
export async function getItemSimilarListings(
  adId: string,
  maxResults: number = 10,
): Promise<ItemSimilarResult> {
  // Step 1: Get listing profile
  const profile = await getListingProfile(adId);

  const category = resolveSearchCategory(profile);

  // Step 2: Build search strategies
  const strategies: { keyword: string; priceFrom?: number; priceTo?: number; label: string }[] = [];

  // Strategy 1: Brand + model search with price range
  const brandModel = [profile.brand, profile.model].filter(Boolean).join(' ');
  if (brandModel) {
    const priceFrom = profile.price ? Math.round(profile.price * 0.5) : undefined;
    const priceTo = profile.price ? Math.round(profile.price * 1.5) : undefined;
    strategies.push({ keyword: brandModel, priceFrom, priceTo, label: 'brand+model+price' });
  }

  // Strategy 2: Title-based search (extract key words)
  const titleWords = profile.title
    .split(/\s+/)
    .filter((w: string) => w.length > 2 && !/^(der|die|das|und|für|mit|von|zu|in|an|am|auf|aus|bei|nach|als|nur|auch|noch|schon|oder|aber|sein|haben|werden|sein|ihr|sein|mein|dein|unser|euer|dies|jen|welch|kein|ein|eine|einer|eines|einem|einen)$/i.test(w))
    .slice(0, 5)
    .join(' ');
  if (titleWords) {
    const priceFrom = profile.price ? Math.round(profile.price * 0.4) : undefined;
    const priceTo = profile.price ? Math.round(profile.price * 2.0) : undefined;
    strategies.push({ keyword: titleWords, priceFrom, priceTo, label: 'title+price' });
  }

  // Strategy 3: Category-only with tight price range (fallback)
  if (profile.price) {
    strategies.push({
      keyword: '',
      priceFrom: Math.round(profile.price * 0.6),
      priceTo: Math.round(profile.price * 1.4),
      label: 'category+price',
    });
  }

  // Step 3: Execute strategies and merge results
  const seen = new Set<string>();
  const allResults: ItemSimilarListing[] = [];
  let usedStrategy = '';

  for (const strategy of strategies) {
    if (allResults.length >= maxResults * 2) break; // enough results

    const results = await searchSimilar(
      profile,
      category.category,
      strategy.keyword,
      strategy.priceFrom,
      strategy.priceTo,
      maxResults * 2,
    );

    for (const r of results) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        allResults.push(r);
      }
    }

    if (results.length > 0 && !usedStrategy) {
      usedStrategy = strategy.label;
    }
  }

  // If no category-specific results, try broad marktplatz search
  if (allResults.length === 0 && category.category !== '301') {
    const results = await searchSimilar(profile, '301', profile.title.split(' ').slice(0, 3).join(' '));
    for (const r of results) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        allResults.push(r);
      }
    }
    if (results.length > 0) usedStrategy = 'broad-marktplatz';
  }

  return {
    sourceId: adId,
    sourceTitle: profile.title,
    sourcePrice: profile.price,
    items: allResults.slice(0, maxResults),
    searchStrategy: usedStrategy || 'none',
  };
}
