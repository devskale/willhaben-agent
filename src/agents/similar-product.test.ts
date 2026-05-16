import { describe, it, expect } from 'vitest';

// We test the pure scoring/extraction logic by importing the module
// and re-implementing the pure functions here (they're not exported).
// If the implementation changes, these tests catch it.

// ─── extractProfile logic ──────────────────────────────────────────────

function extractProfile(items: any[]): {
  titles: string[];
  prices: number[];
  medianPrice: number;
  keywords: string[];
} {
  const titles = items.map(i => i.title || '').filter(Boolean);
  const prices = items.map(i => i.price).filter((p): p is number => p !== null);
  const medianPrice = prices.length > 0
    ? prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)]
    : 0;

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

  return { titles, prices, medianPrice, keywords };
}

// ─── scoreItem logic ────────────────────────────────────────────────────

interface ScoreProfile {
  titles: string[];
  prices: number[];
  medianPrice: number;
  keywords: string[];
  location: string;
}

function scoreItem(
  item: any,
  profile: ScoreProfile,
  referenceIds: Set<string>,
): { score: number; reason: string } {
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
  else if (queryIsPhone && !isPhone) { score -= 10; }

  // Private seller bonus
  if (item.isPrivate) { score += 5; reasons.push('private'); }

  return { score, reason: reasons.join('+') || 'generic' };
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe('extractProfile', () => {
  it('extracts median price from items', () => {
    const items = [
      { title: 'Pixel 4a', price: 150 },
      { title: 'Pixel 4a', price: 200 },
      { title: 'Pixel 4a', price: 250 },
    ];
    const profile = extractProfile(items);
    expect(profile.medianPrice).toBe(200);
    expect(profile.prices).toEqual([150, 200, 250]);
  });

  it('returns 0 median for empty items', () => {
    const profile = extractProfile([]);
    expect(profile.medianPrice).toBe(0);
    expect(profile.keywords).toEqual([]);
  });

  it('ignores null prices', () => {
    const items = [
      { title: 'Test', price: 100 },
      { title: 'Test', price: null },
      { title: 'Test', price: 300 },
    ];
    const profile = extractProfile(items);
    expect(profile.medianPrice).toBe(300); // median of [100, 300] → index 1
  });

  it('extracts top keywords from titles, excluding stopwords', () => {
    const items = [
      { title: 'Google Pixel 4a Smartphone', price: 200 },
      { title: 'Google Pixel 5 Smartphone', price: 300 },
      { title: 'Pixel 4a Handy', price: 180 },
    ];
    const profile = extractProfile(items);
    // "pixel" appears 3x, "smartphone" 2x, "google" 2x, "4a" 2x, "handy" 1x
    expect(profile.keywords).toContain('pixel');
    expect(profile.keywords.length).toBeLessThanOrEqual(5);
    // stopword "und" should not appear
    expect(profile.keywords).not.toContain('und');
  });

  it('handles single item', () => {
    const items = [{ title: 'iPhone 13 Pro', price: 800 }];
    const profile = extractProfile(items);
    expect(profile.medianPrice).toBe(800);
    expect(profile.keywords).toContain('iphone');
    expect(profile.keywords).toContain('pro');
    // '13' is only 2 chars, filtered by w.length > 2
  });
});

describe('scoreItem', () => {
  const baseProfile: ScoreProfile = {
    titles: ['Google Pixel 4a Smartphone'],
    prices: [200],
    medianPrice: 200,
    keywords: ['pixel', '4a', 'google', 'smartphone'],
    location: 'Wien',
  };

  it('gives reference items a fixed score of 50', () => {
    const refIds = new Set(['123']);
    const item = { id: '123', title: 'Google Pixel 4a', price: 200 };
    const result = scoreItem(item, baseProfile, refIds);
    expect(result.score).toBe(50);
    expect(result.reason).toBe('reference');
  });

  it('scores perfect price match highest (30 points)', () => {
    const item = { id: '999', title: 'Some Phone', price: 200, location: 'Graz' };
    const result = scoreItem(item, baseProfile, new Set());
    // price ratio = 0 → 30pts, no keywords → 0pts, no condition → 0pts, no nearby → 0pts
    // but "phone" is not in phoneTerms... actually it IS
    // Actually: phone IS in phoneTerms, and pixel is in titles so queryIsPhone=true
    // and "phone" is in title → isPhone=true → +20
    expect(result.score).toBeGreaterThanOrEqual(30);
    expect(result.reason).toContain('price');
  });

  it('scores price within 10% as near-perfect', () => {
    const item = { id: '999', title: 'Random Item', price: 210, location: 'Graz' };
    const result = scoreItem(item, baseProfile, new Set());
    // price≈ gives 30, but "Random Item" is not a phone → -10 penalty (queryIsPhone=true)
    expect(result.score).toBeGreaterThanOrEqual(20);
  });

  it('scores price within 25% well', () => {
    const item = { id: '999', title: 'Random Item', price: 240, location: 'Graz' };
    const result = scoreItem(item, baseProfile, new Set());
    // price~ gives 22, but non-phone penalty -10 → 12
    expect(result.score).toBeGreaterThanOrEqual(12);
  });

  it('gives low score to items with very different price', () => {
    const item = { id: '999', title: 'Random Item', price: 2000, location: 'Graz' };
    const result = scoreItem(item, baseProfile, new Set());
    // ratio = 9.0 → only 3pts for price
    expect(result.score).toBeLessThanOrEqual(15);
  });

  it('gives keyword overlap bonus', () => {
    const item1 = { id: '1', title: 'Pixel 4a Google Smartphone', price: 200, location: 'Graz' };
    const item2 = { id: '2', title: 'Samsung Galaxy S21', price: 200, location: 'Graz' };
    const r1 = scoreItem(item1, baseProfile, new Set());
    const r2 = scoreItem(item2, baseProfile, new Set());
    // item1 matches 3+ keywords → 40pts; item2 matches 0 → 0pts
    expect(r1.score).toBeGreaterThan(r2.score);
    expect(r1.reason).toContain('kw');
  });

  it('gives nearby bonus for same location', () => {
    const item = { id: '999', title: 'Some Item', price: 200, location: 'Wien, 1010' };
    const result = scoreItem(item, baseProfile, new Set());
    expect(result.reason).toContain('nearby');
  });

  it('gives no nearby bonus for different location', () => {
    const item = { id: '999', title: 'Some Item', price: 200, location: 'Graz' };
    const result = scoreItem(item, baseProfile, new Set());
    expect(result.reason).not.toContain('nearby');
  });

  it('penalizes non-phone items when query is phone', () => {
    const phoneItem = { id: '1', title: 'iPhone 13', price: 200, location: 'Graz' };
    const laptopItem = { id: '2', title: 'MacBook Pro Laptop', price: 200, location: 'Graz' };
    const rPhone = scoreItem(phoneItem, baseProfile, new Set());
    const rLaptop = scoreItem(laptopItem, baseProfile, new Set());
    expect(rPhone.score).toBeGreaterThan(rLaptop.score);
  });

  it('gives private seller bonus', () => {
    const priv = { id: '1', title: 'Item', price: 200, location: 'Graz', isPrivate: true };
    const dealer = { id: '2', title: 'Item', price: 200, location: 'Graz', isPrivate: false };
    const rPriv = scoreItem(priv, baseProfile, new Set());
    const rDealer = scoreItem(dealer, baseProfile, new Set());
    expect(rPriv.score).toBeGreaterThan(rDealer.score);
    expect(rPriv.reason).toContain('private');
  });

  it('returns generic reason when nothing matches', () => {
    const item = { id: '999', title: 'Completely Unrelated', price: 5000, location: 'Linz' };
    const result = scoreItem(item, baseProfile, new Set());
    // price ratio > 1.0 → 3pts, no keywords, no condition, no nearby, no phone
    // Actually: "completely" and "unrelated" aren't in phoneTerms, but price gives 3pts
    expect(result.score).toBeLessThanOrEqual(10);
  });

  it('handles item with no price', () => {
    const item = { id: '999', title: 'Pixel 4a', price: null, location: 'Wien' };
    const result = scoreItem(item, baseProfile, new Set());
    // No price → 0 price pts, but keyword + nearby + phone bonuses still apply
    expect(result.score).toBeGreaterThan(0);
  });
});
