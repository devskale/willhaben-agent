/**
 * Product similarity search — type a product name, find comparable listings.
 *
 * Flow:
 * 1. Search for the product → pick top result as "reference"
 * 2. Extract category, price range, brand from the reference
 * 3. Broaden search to find alternatives in same category/price band
 * 4. Score by attribute overlap + price proximity
 * 5. Return ranked list
 */

import { getVisitorCookies } from './auth.js';
import { searchMarktplatz } from './search-marktplatz.js';

import { WH_CLIENT, UA } from '../lib/constants.js';

export interface ProductMatch {
  id: string;
  title: string;
  price: number | null;
  priceText: string;
  location: string;
  imageUrl: string;
  url: string;
  /** Similarity score 0-100 */
  score: number;
  /** Price difference from median reference price */
  priceDiff: number | null;
  /** Why this matched */
  reason: string;
}

export interface ProductSimilarResult {
  query: string;
  referenceCount: number;
  medianPrice: number | null;
  category: string;
  items: ProductMatch[];
}

// ─── Reference extraction ───────────────────────────────────────────────

interface ReferenceProfile {
  titles: string[];
  prices: number[];
  medianPrice: number;
  keywords: string[];
  category: string;
  location: string;
}

function extractProfile(items: any[]): ReferenceProfile {
  const titles = items.map(i => i.title || '').filter(Boolean);
  const prices = items.map(i => i.price).filter((p): p is number => p !== null);
  const medianPrice = prices.length > 0
    ? prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)]
    : 0;

  // Extract common keywords from titles
  const allWords = titles.join(' ').toLowerCase().split(/\s+/);
  const stopWords = new Set([
    'der', 'die', 'das', 'und', 'für', 'mit', 'von', 'zu', 'in', 'an', 'am',
    'auf', 'aus', 'bei', 'nach', 'als', 'nur', 'auch', 'noch', 'schon', 'oder',
    'aber', 'sein', 'haben', 'werden', 'ihr', 'mein', 'dein', 'unser', 'euer',
    'dies', 'welch', 'kein', 'ein', 'eine', 'einer', 'eines', 'einem', 'einen',
    'the', 'and', 'for', 'with', 'from', 'this', 'that',
    'verkaufe', 'verkaufen', 'biete', 'verkauf', 'gebraucht', 'neu', 'wie',
    'neuwertig', 'top', 'zustand', 'defekt', 'funktioniert', 'reparatur',
  ]);
  const freq = new Map<string, number>();
  for (const w of allWords) {
    if (w.length > 2 && !stopWords.has(w)) {
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }
  const keywords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w);

  // Most common location prefix (e.g. "Wien")
  const locations = items.map(i => i.location || '').filter(Boolean);
  const locationPrefixes = locations.map(l => l.split(',')[0]?.trim()).filter(Boolean);
  const locationCounts = new Map<string, number>();
  for (const l of locationPrefixes) {
    locationCounts.set(l, (locationCounts.get(l) || 0) + 1);
  }
  const topLocation = [...locationCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';

  return { titles, prices, medianPrice, keywords, category: '', location: topLocation };
}

// ─── Core search ────────────────────────────────────────────────────────

async function apiSearch(
  keyword: string,
  rows: number = 40,
  priceFrom?: number,
  priceTo?: number,
): Promise<any[]> {
  const { csrfToken, cookieHeader } = await getVisitorCookies();

  const params = new URLSearchParams({
    rows: String(rows),
    page: '1',
  });

  if (keyword) params.set('keyword', keyword);
  if (priceFrom !== undefined) params.set('price_from', String(Math.round(priceFrom)));
  if (priceTo !== undefined) params.set('price_to', String(Math.round(priceTo)));

  const url = `https://www.willhaben.at/webapi/ad-search/search/atz/5/301/atverz?${params}`;

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

  return items.map((item: any) => {
    const attrs: Record<string, string[]> = {};
    for (const a of item.attributes?.attribute || []) attrs[a.name] = a.values || [];
    const getVal = (name: string) => attrs[name]?.[0] || '';

    return {
      id: String(item.id),
      title: getVal('HEADING') || item.description || '',
      price: parseFloat(getVal('PRICE')) || null,
      priceText: getVal('PRICE_FOR_DISPLAY') || '',
      location: [getVal('POSTCODE'), getVal('LOCATION')].filter(Boolean).join(', '),
      imageUrl: item.advertImageList?.advertImage?.[0]?.mainImageUrl || '',
      url: `https://www.willhaben.at/iad/object?adId=${item.id}`,
      brand: getVal('BRAND') || getVal('BRAND/FABRIKAT') || getVal('MANUFACTURER') || '',
      condition: getVal('CONDITION') || getVal('ZUSTAND') || '',
      isPrivate: getVal('ISPRIVATE') === '1',
    };
  });
}

// ─── Scoring ───────────────────────────────────────────────────────────

function scoreItem(
  item: any,
  profile: ReferenceProfile,
  referenceIds: Set<string>,
): { score: number; reason: string } {
  // Reference items get a medium score, they'll be sorted after alternatives
  if (referenceIds.has(item.id)) return { score: 50, reason: 'reference' };

  let score = 0;
  const reasons: string[] = [];

  // Price proximity (0-30 points)
  if (profile.medianPrice > 0 && item.price) {
    const ratio = Math.abs(item.price - profile.medianPrice) / profile.medianPrice;
    if (ratio < 0.1) { score += 30; reasons.push('price≈'); }
    else if (ratio < 0.25) { score += 22; reasons.push('price~'); }
    else if (ratio < 0.5) { score += 15; reasons.push('price±'); }
    else if (ratio < 1.0) { score += 8; reasons.push('price±'); }
    else { score += 3; }
  }

  // Keyword overlap (0-40 points)
  const titleLower = item.title.toLowerCase();
  const titleWords = titleLower.split(/\s+/);
  let keywordHits = 0;
  for (const kw of profile.keywords) {
    if (titleLower.includes(kw)) keywordHits++;
  }
  if (keywordHits >= 3) { score += 40; reasons.push(`${keywordHits}kw`); }
  else if (keywordHits >= 2) { score += 28; reasons.push(`${keywordHits}kw`); }
  else if (keywordHits >= 1) { score += 15; reasons.push(`${keywordHits}kw`); }

  // Condition match (0-10 points)
  if (profile.titles.length > 0) {
    const refCond = profile.titles[0]?.toLowerCase().includes('neu') ? 'neu' : 'gebraucht';
    if (titleLower.includes(refCond)) { score += 10; reasons.push(refCond); }
  }

  // Same area bonus (0-10 points)
  if (profile.location && item.location?.includes(profile.location)) {
    score += 10;
    reasons.push('nearby');
  }

  // Competing product type bonus (0-20 points)
  const phoneTerms = ['phone', 'smartphone', 'handy', 'iphone', 'samsung', 'galaxy',
    'huawei', 'xiaomi', 'oneplus', 'nokia', 'sony', 'motorola', 'oppo',
    'pixel', 'nexus', ' rog phone', 'blackberry'];
  const isPhone = phoneTerms.some(t => titleLower.includes(t));
  const queryIsPhone = phoneTerms.some(t => profile.titles.join(' ').toLowerCase().includes(t));
  if (queryIsPhone && isPhone) { score += 20; reasons.push('phone'); }
  else if (queryIsPhone && !isPhone) { score -= 10; } // penalty for non-matching type

  // Private seller bonus (often better deals)
  if (item.isPrivate) { score += 5; reasons.push('private'); }

  return { score, reason: reasons.join('+') || 'generic' };
}

// ─── Main ──────────────────────────────────────────────────────────────

/**
 * Find similar products by name.
 *
 * @param query Product name, e.g. "pixel 4a", "iphone 13", "playstation 5"
 * @param maxResults Max items to return
 */
export async function findSimilarProducts(
  query: string,
  maxResults: number = 15,
): Promise<ProductSimilarResult> {
  // Step 1: Search for the query to build a reference profile
  const refItems = await apiSearch(query, 20);

  if (refItems.length === 0) {
    return { query, referenceCount: 0, medianPrice: null, category: '', items: [] };
  }

  const referenceIds = new Set(refItems.map((i: any) => i.id));
  const profile = extractProfile(refItems);

  // Step 2: Broader search to find alternatives
  // Strategy A: broader keyword (just brand/first keyword) with price filter
  const broadQuery = profile.keywords.length > 1
    ? profile.keywords[0]  // e.g. just "pixel" instead of "pixel 4a"
    : profile.keywords.slice(0, 2).join(' ');
  const priceFrom = profile.medianPrice > 0 ? Math.round(profile.medianPrice * 0.4) : undefined;
  const priceTo = profile.medianPrice > 0 ? Math.round(profile.medianPrice * 2.5) : undefined;

  // Strategy B: category-level search (same product type, same price range)
  // Extract product category from titles (e.g. "smartphone", "handy", "auto")
  const productWords = ['smartphone', 'handy', 'phone', 'telefon', 'iphone', 'samsung', 'pixel',
    'laptop', 'macbook', 'computer', 'pc', 'tablet', 'ipad',
    'auto', 'motorrad', 'fahrrad', 'e-bike', 'fahrrad',
    'playstation', 'xbox', 'nintendo', 'konsole',
    'fernseher', 'tv', 'monitor',
    'boots', 'schuhe', 'jacke', 'winterjacke'];
  const titleLower = profile.titles.join(' ').toLowerCase();
  const categoryHint = productWords.find(w => titleLower.includes(w)) || '';
  
  const candidates = await apiSearch(broadQuery, 50, priceFrom, priceTo);
  
  // Also search with category hint if different from main query
  // Map product keywords to broader category searches
  const categorySynonyms: Record<string, string> = {
    'pixel': 'smartphone', 'iphone': 'smartphone', 'samsung': 'smartphone',
    'smartphone': 'handy', 'handy': 'smartphone', 'phone': 'smartphone',
    'telefon': 'smartphone', 'ipad': 'tablet', 'tablet': 'ipad',
    'macbook': 'laptop', 'laptop': 'notebook',
    'playstation': 'konsole', 'xbox': 'konsole', 'nintendo': 'konsole',
    'fahrrad': 'e-bike', 'e-bike': 'fahrrad',
  };
  const synonym = categoryHint ? (categorySynonyms[categoryHint] || '') : '';
  
  let categoryCandidates: any[] = [];
  if (synonym) {
    categoryCandidates = await apiSearch(synonym, 30, priceFrom, priceTo);
  }
  if (categoryHint && !broadQuery.toLowerCase().includes(categoryHint) && broadQuery.toLowerCase() !== categoryHint) {
    const more = await apiSearch(categoryHint, 30, priceFrom, priceTo);
    categoryCandidates = [...categoryCandidates, ...more];
  }

  // Step 3: Score all candidates
  const allItems = [...refItems, ...candidates, ...categoryCandidates];
  const seen = new Set<string>();
  const scored: ProductMatch[] = [];

  for (const item of allItems) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);

    const { score, reason } = scoreItem(item, profile, referenceIds);
    if (score < 3) continue; // skip very low relevance

    const priceDiff = item.price !== null && profile.medianPrice > 0
      ? item.price - profile.medianPrice
      : null;

    scored.push({
      id: item.id,
      title: item.title,
      price: item.price,
      priceText: item.priceText,
      location: item.location,
      imageUrl: item.imageUrl,
      url: item.url,
      score,
      priceDiff,
      reason,
    });
  }

  // Sort: non-reference items first (by score), then reference items (by score)
  scored.sort((a, b) => {
    const aRef = referenceIds.has(a.id) ? 1 : 0;
    const bRef = referenceIds.has(b.id) ? 1 : 0;
    if (aRef !== bRef) return aRef - bRef; // non-reference first
    return b.score - a.score || (a.price || 0) - (b.price || 0);
  });

  return {
    query,
    referenceCount: refItems.length,
    medianPrice: profile.medianPrice || null,
    category: profile.keywords.join(' '),
    items: scored.slice(0, maxResults),
  };
}
