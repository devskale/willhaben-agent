import { describe, it, expect } from 'vitest';
import {
  filterByKeyword,
  excludeByKeyword,
  filterByType,
  classifyPropertyType,
  filterBySize,
  filterByRooms,
  filterByPrice,
} from './analysis.js';
import type { Listing } from '../types.js';

const item = (overrides: Partial<Listing> = {}): Listing => ({
  id: '1',
  title: 'Test Item',
  price: 100,
  priceText: '€ 100',
  location: 'Wien',
  description: 'A test description',
  url: 'https://example.com',
  imageUrl: '',
  estateSize: 50,
  rooms: '3',
  floor: null,
  propertyType: null,
  pricePerSqm: null,
  sellerName: 'Test',
  condition: '',
  paylivery: false,
  ...overrides,
});

// ─── filterByKeyword ─────────────────────────────────────────────────────

describe('filterByKeyword', () => {
  const items = [
    item({ title: 'Google Pixel 4a Smartphone' }),
    item({ title: 'Samsung Galaxy S21' }),
    item({ title: 'iPhone 13 Pro' }),
  ];

  it('returns all items when keywords empty', () => {
    expect(filterByKeyword(items, [])).toHaveLength(3);
  });

  it('matches single keyword in title', () => {
    expect(filterByKeyword(items, ['pixel'])).toHaveLength(1);
    expect(filterByKeyword(items, ['pixel'])[0].title).toContain('Pixel');
  });

  it('matches case-insensitive', () => {
    expect(filterByKeyword(items, ['GOOGLE'])).toHaveLength(1);
  });

  it('matches ANY keyword (OR logic)', () => {
    const result = filterByKeyword(items, ['pixel', 'samsung']);
    expect(result).toHaveLength(2);
  });

  it('returns empty when no match', () => {
    expect(filterByKeyword(items, ['playstation'])).toHaveLength(0);
  });

  it('searches description when flag set', () => {
    const withDesc = [
      item({ title: 'Phone', description: 'Google Pixel smartphone' }),
      item({ title: 'Phone', description: 'Samsung Galaxy' }),
    ];
    expect(filterByKeyword(withDesc, ['pixel'], true)).toHaveLength(1);
    expect(filterByKeyword(withDesc, ['pixel'], false)).toHaveLength(0);
  });
});

// ─── excludeByKeyword ────────────────────────────────────────────────────

describe('excludeByKeyword', () => {
  const items = [
    item({ title: 'Google Pixel 4a' }),
    item({ title: 'Samsung Galaxy' }),
    item({ title: 'iPhone 13' }),
  ];

  it('returns all items when excludes empty', () => {
    expect(excludeByKeyword(items, [])).toHaveLength(3);
  });

  it('excludes matching items', () => {
    expect(excludeByKeyword(items, ['samsung'])).toHaveLength(2);
    expect(excludeByKeyword(items, ['samsung']).map(i => i.title)).not.toContain('Samsung Galaxy');
  });

  it('excludes multiple keywords', () => {
    expect(excludeByKeyword(items, ['pixel', 'iphone'])).toHaveLength(1);
  });

  it('excludes from description when flag set', () => {
    const withDesc = [
      item({ title: 'Phone', description: 'defekt' }),
      item({ title: 'Phone', description: 'top zustand' }),
    ];
    expect(excludeByKeyword(withDesc, ['defekt'], true)).toHaveLength(1);
  });
});

// ─── classifyPropertyType ────────────────────────────────────────────────

describe('classifyPropertyType', () => {
  it('classifies wohnung', () => {
    expect(classifyPropertyType(item({ title: 'Schöne Eigentumswohnung' }))).toBe('wohnung');
  });

  it('classifies haus', () => {
    expect(classifyPropertyType(item({ title: 'Einfamilienhaus mit Garten' }))).toBe('haus');
  });

  it('classifies by propertyType field', () => {
    expect(classifyPropertyType(item({ title: 'Test', propertyType: 'Mietwohnung' }))).toBe('mietobjekt');
  });

  it('returns null for non-matching', () => {
    expect(classifyPropertyType(item({ title: 'Pixel 4a Smartphone' }))).toBeNull();
  });
});

// ─── filterBySize ────────────────────────────────────────────────────────

describe('filterBySize', () => {
  const items = [
    item({ estateSize: 30 }),
    item({ estateSize: 60 }),
    item({ estateSize: 120 }),
    item({ estateSize: null }),
  ];

  it('returns all when no bounds', () => {
    expect(filterBySize(items)).toHaveLength(4);
  });

  it('filters by min size', () => {
    expect(filterBySize(items, 50)).toHaveLength(3); // 60, 120, null
  });

  it('filters by max size', () => {
    expect(filterBySize(items, undefined, 50)).toHaveLength(2); // 30, null
  });

  it('filters by range', () => {
    expect(filterBySize(items, 40, 100)).toHaveLength(2); // 60, null
  });

  it('keeps items with null size', () => {
    const result = filterBySize(items, 50, 100);
    expect(result.some(i => i.estateSize === null)).toBe(true);
  });
});

// ─── filterByRooms ───────────────────────────────────────────────────────

describe('filterByRooms', () => {
  const items = [
    item({ rooms: '2' }),
    item({ rooms: '3' }),
    item({ rooms: '4' }),
    item({ rooms: null }),
  ];

  it('returns all when no bounds', () => {
    expect(filterByRooms(items)).toHaveLength(4);
  });

  it('filters by exact rooms', () => {
    expect(filterByRooms(items, 3)).toHaveLength(2); // 3, null
  });

  it('filters by min rooms', () => {
    expect(filterByRooms(items, undefined, 3)).toHaveLength(3); // 3, 4, null
  });

  it('keeps items with null rooms', () => {
    const result = filterByRooms(items, 3);
    expect(result.some(i => i.rooms === null)).toBe(true);
  });
});

// ─── filterByPrice ───────────────────────────────────────────────────────

describe('filterByPrice', () => {
  const items = [
    item({ price: 50 }),
    item({ price: 200 }),
    item({ price: 1000 }),
    item({ price: null }),
  ];

  it('excludes null prices', () => {
    expect(filterByPrice(items)).toHaveLength(3);
  });

  it('filters by min price', () => {
    expect(filterByPrice(items, 100)).toHaveLength(2); // 200, 1000
  });

  it('filters by max price', () => {
    expect(filterByPrice(items, undefined, 200)).toHaveLength(2); // 50, 200
  });

  it('filters by range', () => {
    expect(filterByPrice(items, 100, 500)).toHaveLength(1); // 200
  });
});
