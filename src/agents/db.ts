import Database from "better-sqlite3";
import { Listing } from "../types.js";
import path from "path";
import fs from "fs";

// Initialize DB
const dbPath = path.resolve(process.cwd(), "willhaben.db");
const db = new Database(dbPath);

// Create table if not exists
// Added missing columns: price, description, url, condition
db.exec(`
  CREATE TABLE IF NOT EXISTS starred_items (
    id TEXT PRIMARY KEY,
    title TEXT,
    price REAL,
    price_text TEXT,
    location TEXT,
    description TEXT,
    url TEXT,
    condition TEXT,
    seller_name TEXT,
    paylivery INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL,
    total_found INTEGER DEFAULT 0,
    category_id TEXT,
    price_min REAL,
    price_max REAL,
    area_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Regions table: Bundesländer + Bezirke
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS regions (
      area_id INTEGER PRIMARY KEY,
      parent_id INTEGER,
      name TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'district'
    )
  `);
} catch {
  // Table might already exist
}

// Categories table
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      category_id INTEGER PRIMARY KEY,
      parent_id INTEGER,
      name TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
} catch {
  // Table might already exist
}

// Wishlist table
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wishlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      search_query TEXT NOT NULL,
      description TEXT,
      category_id INTEGER,
      price_max REAL,
      notes TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
} catch {
  // Table might already exist
}
try {
  // Remove duplicates, keeping the most recent one
  db.exec(`
    DELETE FROM search_history 
    WHERE id NOT IN (
      SELECT MAX(id) 
      FROM search_history 
      GROUP BY query
    )
  `);

  // Create unique index
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_search_history_query 
    ON search_history(query)
  `);
} catch (error) {
  // Index might already exist or other error, strictly speaking we should handle better but for now safe to ignore if it fails due to existing
}

export interface StarredItem extends Listing {
  starredAt: string;
}

export interface SearchHistoryItem {
  id: number;
  query: string;
  totalFound: number;
  categoryId?: string;
  priceMin?: number;
  priceMax?: number;
  areaId?: number;
  createdAt: string;
}

const stmtInsert = db.prepare(`
  INSERT INTO starred_items (id, title, price, price_text, location, description, url, condition, seller_name, paylivery)
  VALUES (@id, @title, @price, @priceText, @location, @description, @url, @condition, @sellerName, @paylivery)
`);

const stmtDelete = db.prepare(`
  DELETE FROM starred_items WHERE id = ?
`);

const stmtCheck = db.prepare(`
  SELECT 1 FROM starred_items WHERE id = ?
`);

const stmtList = db.prepare(`
  SELECT * FROM starred_items ORDER BY created_at DESC
`);

export function toggleStar(item: Listing): boolean {
  const isStarred = stmtCheck.get(item.id);

  if (isStarred) {
    stmtDelete.run(item.id);
    return false;
  } else {
    stmtInsert.run({
      id: item.id,
      title: item.title,
      price: item.price,
      priceText: item.priceText,
      location: item.location,
      description: item.description,
      url: item.url,
      condition: item.condition,
      sellerName: item.sellerName,
      paylivery: item.paylivery ? 1 : 0,
    });
    return true;
  }
}

export function isStarred(id: string): boolean {
  return !!stmtCheck.get(id);
}

export function getStarredItems(): StarredItem[] {
  const rows = stmtList.all() as any[];
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    price: row.price,
    priceText: row.price_text,
    location: row.location,
    description: row.description,
    url: row.url,
    condition: row.condition,
    sellerName: row.seller_name,
    paylivery: Boolean(row.paylivery),
    starredAt: row.created_at,
    estateSize: row.estate_size ?? null,
    rooms: row.rooms ?? null,
    floor: row.floor ?? null,
    propertyType: row.property_type ?? null,
    pricePerSqm: row.price_per_sqm ?? null,
  }));
}

const stmtInsertHistory = db.prepare(`
  INSERT INTO search_history (query, total_found, category_id, price_min, price_max, area_id, created_at)
  VALUES (@query, @totalFound, @categoryId, @priceMin, @priceMax, @areaId, CURRENT_TIMESTAMP)
  ON CONFLICT(query) DO UPDATE SET
    total_found = excluded.total_found,
    category_id = excluded.category_id,
    price_min = excluded.price_min,
    price_max = excluded.price_max,
    area_id = excluded.area_id,
    created_at = excluded.created_at
`);

const stmtTrimHistory = db.prepare(`
  DELETE FROM search_history WHERE id NOT IN (
    SELECT id FROM search_history ORDER BY created_at DESC LIMIT 100
  )
`);

const stmtListHistory = db.prepare(`
  SELECT * FROM search_history ORDER BY created_at DESC
`);

export function addSearchHistory(
  query: string,
  totalFound: number = 0,
  categoryId?: string,
  priceMin?: number,
  priceMax?: number,
  areaId?: number,
) {
  // Validation: Not empty and min length 2
  if (!query || query.trim().length < 2) {
    return;
  }

  stmtInsertHistory.run({
    query: query.trim(),
    totalFound,
    categoryId: categoryId || null,
    priceMin: priceMin ?? null,
    priceMax: priceMax ?? null,
    areaId: areaId ?? null,
  });
  stmtTrimHistory.run();
}

export function getSearchHistory(): SearchHistoryItem[] {
  const rows = stmtListHistory.all() as any[];
  return rows.map((row) => ({
    id: row.id,
    query: row.query,
    totalFound: row.total_found || 0,
    categoryId: row.category_id || undefined,
    priceMin: row.price_min ?? undefined,
    priceMax: row.price_max ?? undefined,
    areaId: row.area_id ?? undefined,
    createdAt: row.created_at,
  }));
}

// --- Regions ---

export interface Region {
  areaId: number;
  parentId: number | null;
  name: string;
  level: 'state' | 'district';
}

const stmtGetRegions = db.prepare(
  'SELECT area_id, parent_id, name, level FROM regions WHERE parent_id = ? ORDER BY area_id'
);

const stmtCountRegions = db.prepare('SELECT COUNT(*) as count FROM regions');

const stmtInsertRegion = db.prepare(
  'INSERT OR REPLACE INTO regions (area_id, parent_id, name, level) VALUES (@areaId, @parentId, @name, @level)'
);

export function getSubRegions(parentAreaId: number): Region[] {
  const rows = stmtGetRegions.all(parentAreaId) as any[];
  return rows.map((row) => ({
    areaId: row.area_id,
    parentId: row.parent_id,
    name: row.name,
    level: row.level,
  }));
}

export function seedRegions(): void {
  const count = (stmtCountRegions.get() as any)?.count || 0;
  if (count > 0) return; // Already seeded

  const insertMany = db.transaction((regions: Region[]) => {
    for (const r of regions) {
      stmtInsertRegion.run(r);
    }
  });

  // Wien Bezirke (parent: 900)
  const wien: Region[] = [
    { areaId: 117223, parentId: 900, name: 'Wien, 01. Bezirk, Innere Stadt', level: 'district' },
    { areaId: 117224, parentId: 900, name: 'Wien, 02. Bezirk, Leopoldstadt', level: 'district' },
    { areaId: 117225, parentId: 900, name: 'Wien, 03. Bezirk, Landstraße', level: 'district' },
    { areaId: 117226, parentId: 900, name: 'Wien, 04. Bezirk, Wieden', level: 'district' },
    { areaId: 117227, parentId: 900, name: 'Wien, 05. Bezirk, Margareten', level: 'district' },
    { areaId: 117228, parentId: 900, name: 'Wien, 06. Bezirk, Mariahilf', level: 'district' },
    { areaId: 117229, parentId: 900, name: 'Wien, 07. Bezirk, Neubau', level: 'district' },
    { areaId: 117230, parentId: 900, name: 'Wien, 08. Bezirk, Josefstadt', level: 'district' },
    { areaId: 117231, parentId: 900, name: 'Wien, 09. Bezirk, Alsergrund', level: 'district' },
    { areaId: 117232, parentId: 900, name: 'Wien, 10. Bezirk, Favoriten', level: 'district' },
    { areaId: 117233, parentId: 900, name: 'Wien, 11. Bezirk, Simmering', level: 'district' },
    { areaId: 117234, parentId: 900, name: 'Wien, 12. Bezirk, Meidling', level: 'district' },
    { areaId: 117235, parentId: 900, name: 'Wien, 13. Bezirk, Hietzing', level: 'district' },
    { areaId: 117236, parentId: 900, name: 'Wien, 14. Bezirk, Penzing', level: 'district' },
    { areaId: 117237, parentId: 900, name: 'Wien, 15. Bezirk, Rudolfsheim-Fünfhaus', level: 'district' },
    { areaId: 117238, parentId: 900, name: 'Wien, 16. Bezirk, Ottakring', level: 'district' },
    { areaId: 117239, parentId: 900, name: 'Wien, 17. Bezirk, Hernals', level: 'district' },
    { areaId: 117240, parentId: 900, name: 'Wien, 18. Bezirk, Währing', level: 'district' },
    { areaId: 117241, parentId: 900, name: 'Wien, 19. Bezirk, Döbling', level: 'district' },
    { areaId: 117242, parentId: 900, name: 'Wien, 20. Bezirk, Brigittenau', level: 'district' },
    { areaId: 117243, parentId: 900, name: 'Wien, 21. Bezirk, Floridsdorf', level: 'district' },
    { areaId: 117244, parentId: 900, name: 'Wien, 22. Bezirk, Donaustadt', level: 'district' },
    { areaId: 117245, parentId: 900, name: 'Wien, 23. Bezirk, Liesing', level: 'district' },
  ];

  // Burgenland Bezirke (parent: 1)
  const bgld: Region[] = [
    { areaId: 101, parentId: 1, name: 'Eisenstadt', level: 'district' },
    { areaId: 102, parentId: 1, name: 'Rust (Stadt)', level: 'district' },
    { areaId: 103, parentId: 1, name: 'Eisenstadt - Umgebung', level: 'district' },
    { areaId: 104, parentId: 1, name: 'Güssing', level: 'district' },
    { areaId: 105, parentId: 1, name: 'Jennersdorf', level: 'district' },
    { areaId: 106, parentId: 1, name: 'Mattersburg', level: 'district' },
    { areaId: 107, parentId: 1, name: 'Neusiedl am See', level: 'district' },
    { areaId: 108, parentId: 1, name: 'Oberpullendorf', level: 'district' },
    { areaId: 109, parentId: 1, name: 'Oberwart', level: 'district' },
  ];

  // Niederösterreich Bezirke (parent: 3)
  const noe: Region[] = [
    { areaId: 305, parentId: 3, name: 'Amstetten', level: 'district' },
    { areaId: 306, parentId: 3, name: 'Baden', level: 'district' },
    { areaId: 307, parentId: 3, name: 'Bruck an der Leitha', level: 'district' },
    { areaId: 308, parentId: 3, name: 'Gänserndorf', level: 'district' },
    { areaId: 309, parentId: 3, name: 'Gmünd', level: 'district' },
    { areaId: 310, parentId: 3, name: 'Hollabrunn', level: 'district' },
    { areaId: 311, parentId: 3, name: 'Horn', level: 'district' },
    { areaId: 312, parentId: 3, name: 'Korneuburg', level: 'district' },
    { areaId: 301, parentId: 3, name: 'Krems an der Donau', level: 'district' },
    { areaId: 313, parentId: 3, name: 'Krems Land', level: 'district' },
    { areaId: 314, parentId: 3, name: 'Lilienfeld', level: 'district' },
    { areaId: 315, parentId: 3, name: 'Melk', level: 'district' },
    { areaId: 316, parentId: 3, name: 'Mistelbach', level: 'district' },
    { areaId: 317, parentId: 3, name: 'Mödling', level: 'district' },
    { areaId: 318, parentId: 3, name: 'Neunkirchen', level: 'district' },
    { areaId: 302, parentId: 3, name: 'Sankt Pölten', level: 'district' },
    { areaId: 319, parentId: 3, name: 'Sankt Pölten Land', level: 'district' },
    { areaId: 320, parentId: 3, name: 'Scheibbs', level: 'district' },
    { areaId: 321, parentId: 3, name: 'Tulln', level: 'district' },
    { areaId: 322, parentId: 3, name: 'Waidhofen an der Thaya', level: 'district' },
    { areaId: 303, parentId: 3, name: 'Waidhofen an der Ybbs', level: 'district' },
    { areaId: 304, parentId: 3, name: 'Wiener Neustadt', level: 'district' },
    { areaId: 323, parentId: 3, name: 'Wiener Neustadt Land', level: 'district' },
    { areaId: 325, parentId: 3, name: 'Zwettl', level: 'district' },
  ];

  insertMany([...wien, ...bgld, ...noe]);
}

// --- Categories ---

export interface Category {
  categoryId: number;
  parentId: number | null;
  name: string;
  count: number;
  updatedAt: string;
}

const stmtGetCategories = db.prepare(
  'SELECT category_id, parent_id, name, count, updated_at FROM categories WHERE parent_id IS NULL ORDER BY category_id'
);
const stmtGetSubCategories = db.prepare(
  'SELECT category_id, parent_id, name, count, updated_at FROM categories WHERE parent_id = ? ORDER BY category_id'
);
const stmtCountCategories = db.prepare('SELECT COUNT(*) as count FROM categories');
const stmtInsertCategory = db.prepare(
  'INSERT OR REPLACE INTO categories (category_id, parent_id, name, count, updated_at) VALUES (@categoryId, @parentId, @name, @count, CURRENT_TIMESTAMP)'
);

export function getCategories(): Category[] {
  return (stmtGetCategories.all() as any[]).map(row => ({
    categoryId: row.category_id,
    parentId: row.parent_id,
    name: row.name,
    count: row.count,
    updatedAt: row.updated_at,
  }));
}

export function getSubCategories(parentId: number): Category[] {
  return (stmtGetSubCategories.all(parentId) as any[]).map(row => ({
    categoryId: row.category_id,
    parentId: row.parent_id,
    name: row.name,
    count: row.count,
    updatedAt: row.updated_at,
  }));
}

export function seedCategories(): void {
  const count = (stmtCountCategories.get() as any)?.count || 0;
  if (count > 0) return;

  const insertMany = db.transaction((cats: Category[]) => {
    for (const c of cats) stmtInsertCategory.run({ ...c, updatedAt: new Date().toISOString() });
  });

  const cats: Category[] = [
    // Root - Marktplatz
    { categoryId: 2691, parentId: null, name: 'Smartphones / Telefonie', count: 106323, updatedAt: '' },
    { categoryId: 3275, parentId: null, name: 'Mode / Accessoires', count: 2596830, updatedAt: '' },
    { categoryId: 3928, parentId: null, name: 'Baby / Kind', count: 1924074, updatedAt: '' },
    { categoryId: 5387, parentId: null, name: 'Wohnen / Haushalt / Gastronomie', count: 1712705, updatedAt: '' },
    { categoryId: 387, parentId: null, name: 'Bücher / Filme / Musik', count: 1493008, updatedAt: '' },
    { categoryId: 6941, parentId: null, name: 'Antiquitäten / Kunst', count: 1287531, updatedAt: '' },
    { categoryId: 5136, parentId: null, name: 'Spielen / Spielzeug', count: 955519, updatedAt: '' },
    { categoryId: 6462, parentId: null, name: 'Freizeit / Instrumente / Kulinarik', count: 894786, updatedAt: '' },
    { categoryId: 4390, parentId: null, name: 'Sport / Sportgeräte', count: 782053, updatedAt: '' },
    { categoryId: 3541, parentId: null, name: 'Haus / Garten / Werkstatt', count: 626279, updatedAt: '' },
    { categoryId: 6142, parentId: null, name: 'KFZ-Zubehör / Motorradteile', count: 559187, updatedAt: '' },
    { categoryId: 2409, parentId: null, name: 'Uhren / Schmuck', count: 407959, updatedAt: '' },
    { categoryId: 3076, parentId: null, name: 'Beauty / Gesundheit / Wellness', count: 229957, updatedAt: '' },
    { categoryId: 6808, parentId: null, name: 'Kameras / TV / Multimedia', count: 209271, updatedAt: '' },
    { categoryId: 2785, parentId: null, name: 'Games / Konsolen', count: 192437, updatedAt: '' },
    { categoryId: 5824, parentId: null, name: 'Computer / Software', count: 171589, updatedAt: '' },
    { categoryId: 4915, parentId: null, name: 'Tiere / Tierbedarf', count: 140051, updatedAt: '' },
    { categoryId: 5007823, parentId: null, name: 'Boote / Yachten / Jetskis', count: 6889, updatedAt: '' },
    { categoryId: 537, parentId: null, name: 'Dienstleistungen', count: 3196, updatedAt: '' },

    // Smartphones / Telefonie (2691)
    { categoryId: 2750, parentId: 2691, name: 'Zubehör Handy / Telefonie', count: 50335, updatedAt: '' },
    { categoryId: 2722, parentId: 2691, name: 'Smartphones / Handys', count: 31598, updatedAt: '' },
    { categoryId: 2771, parentId: 2691, name: 'Smartwatches', count: 11594, updatedAt: '' },
    { categoryId: 2772, parentId: 2691, name: 'Tablets', count: 7589, updatedAt: '' },
    { categoryId: 2765, parentId: 2691, name: 'Telefonie / Fax', count: 4594, updatedAt: '' },
    { categoryId: 2764, parentId: 2691, name: 'Organizer / PDAs', count: 493, updatedAt: '' },
    { categoryId: 2692, parentId: 2691, name: 'Handyservices', count: 120, updatedAt: '' },

    // Smartphones / Handys (2722)
    { categoryId: 2724, parentId: 2722, name: 'Apple', count: 14845, updatedAt: '' },
    { categoryId: 2740, parentId: 2722, name: 'Samsung', count: 6806, updatedAt: '' },
    { categoryId: 2749, parentId: 2722, name: 'andere Hersteller', count: 2807, updatedAt: '' },
    { categoryId: 2738, parentId: 2722, name: 'Nokia', count: 1897, updatedAt: '' },
    { categoryId: 2734, parentId: 2722, name: 'Huawei', count: 1316, updatedAt: '' },
    { categoryId: 7283, parentId: 2722, name: 'Xiaomi', count: 1281, updatedAt: '' },
    { categoryId: 2733, parentId: 2722, name: 'Emporia', count: 674, updatedAt: '' },
    { categoryId: 2737, parentId: 2722, name: 'Motorola', count: 368, updatedAt: '' },
    { categoryId: 2748, parentId: 2722, name: 'Sony Ericsson', count: 308, updatedAt: '' },
    { categoryId: 5014402, parentId: 2722, name: 'Google', count: 292, updatedAt: '' },
    { categoryId: 2736, parentId: 2722, name: 'LG', count: 241, updatedAt: '' },
    { categoryId: 2747, parentId: 2722, name: 'Sony', count: 236, updatedAt: '' },
    { categoryId: 2739, parentId: 2722, name: 'OnePlus', count: 157, updatedAt: '' },
    { categoryId: 2735, parentId: 2722, name: 'HTC', count: 145, updatedAt: '' },
    { categoryId: 2723, parentId: 2722, name: 'Alcatel', count: 130, updatedAt: '' },
    { categoryId: 2732, parentId: 2722, name: 'Blackberry', count: 94, updatedAt: '' },

    // Google (5014402)
    { categoryId: 5014408, parentId: 5014402, name: 'andere Modelle', count: 75, updatedAt: '' },
    { categoryId: 5015994, parentId: 5014402, name: 'Google Pixel 10', count: 64, updatedAt: '' },
    { categoryId: 5014404, parentId: 5014402, name: 'Pixel 7', count: 43, updatedAt: '' },
    { categoryId: 5014406, parentId: 5014402, name: 'Pixel 9', count: 39, updatedAt: '' },
    { categoryId: 5014405, parentId: 5014402, name: 'Pixel 8', count: 36, updatedAt: '' },
    { categoryId: 5014407, parentId: 5014402, name: 'Pixel Fold', count: 24, updatedAt: '' },
    { categoryId: 5014403, parentId: 5014402, name: 'Pixel 6', count: 11, updatedAt: '' },

    // Computer / Software (5824)
    { categoryId: 5826, parentId: 5824, name: 'Notebooks', count: 0, updatedAt: '' },
    { categoryId: 5827, parentId: 5824, name: 'Desktop PCs', count: 0, updatedAt: '' },
    { categoryId: 5828, parentId: 5824, name: 'Tablets', count: 0, updatedAt: '' },
    { categoryId: 5829, parentId: 5824, name: 'Drucker / Scanner', count: 0, updatedAt: '' },
    { categoryId: 5830, parentId: 5824, name: 'Monitore', count: 0, updatedAt: '' },
    { categoryId: 5831, parentId: 5824, name: 'PC-Komponenten', count: 0, updatedAt: '' },
    { categoryId: 5832, parentId: 5824, name: 'Software', count: 0, updatedAt: '' },
    { categoryId: 5852, parentId: 5824, name: 'Einplatinencomputer', count: 0, updatedAt: '' },
    { categoryId: 5856, parentId: 5824, name: 'Zubehör', count: 0, updatedAt: '' },

    // Games / Konsolen (2785)
    { categoryId: 2786, parentId: 2785, name: 'Konsolen', count: 0, updatedAt: '' },
    { categoryId: 2791, parentId: 2785, name: 'Spiele', count: 0, updatedAt: '' },
    { categoryId: 2802, parentId: 2785, name: 'Zubehör', count: 0, updatedAt: '' },
  ];

  insertMany(cats);
}

// --- Vehicle Categories ---
// Stores vehicle sub-verticals (auto, motorrad, etc.) and their filter categories
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicle_subverticals (
      search_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      product_id INTEGER NOT NULL,
      ad_type_id INTEGER NOT NULL,
      url_path TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
} catch {
  // Table might already exist
}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicle_filter_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subvertical_search_id INTEGER NOT NULL,
      filter_name TEXT NOT NULL,
      code TEXT NOT NULL,
      label TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      FOREIGN KEY (subvertical_search_id) REFERENCES vehicle_subverticals(search_id)
    )
  `);
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_vfc_unique
    ON vehicle_filter_categories(subvertical_search_id, filter_name, code)
  `);
} catch {
  // Table might already exist
}

const stmtInsertSubvertical = db.prepare(
  'INSERT OR REPLACE INTO vehicle_subverticals (search_id, name, slug, product_id, ad_type_id, url_path, count, updated_at) VALUES (@searchId, @name, @slug, @productId, @adTypeId, @urlPath, @count, CURRENT_TIMESTAMP)'
);

const stmtInsertFilterCategory = db.prepare(
  'INSERT OR REPLACE INTO vehicle_filter_categories (subvertical_search_id, filter_name, code, label, count) VALUES (@subverticalSearchId, @filterName, @code, @label, @count)'
);

const stmtGetSubverticals = db.prepare(
  'SELECT search_id, name, slug, product_id, ad_type_id, url_path, count FROM vehicle_subverticals ORDER BY count DESC'
);

const stmtGetFilterCategories = db.prepare(
  'SELECT filter_name, code, label, count FROM vehicle_filter_categories WHERE subvertical_search_id = ? AND filter_name = ? ORDER BY count DESC'
);

const stmtCountSubverticals = db.prepare('SELECT COUNT(*) as count FROM vehicle_subverticals');

export interface VehicleSubvertical {
  searchId: number;
  name: string;
  slug: string;
  productId: number;
  adTypeId: number;
  urlPath: string;
  count: number;
}

export interface VehicleFilterCategory {
  filterName: string;
  code: string;
  label: string;
  count: number;
}

export function getVehicleSubverticals(): VehicleSubvertical[] {
  return (stmtGetSubverticals.all() as any[]).map(row => ({
    searchId: row.search_id,
    name: row.name,
    slug: row.slug,
    productId: row.product_id,
    adTypeId: row.ad_type_id,
    urlPath: row.url_path,
    count: row.count,
  }));
}

export function getVehicleFilterCategories(searchId: number, filterName: string): VehicleFilterCategory[] {
  return (stmtGetFilterCategories.all(searchId, filterName) as any[]).map(row => ({
    filterName: row.filter_name,
    code: row.code,
    label: row.label,
    count: row.count,
  }));
}

export function seedVehicleCategories(): void {
  const count = (stmtCountSubverticals.get() as any)?.count || 0;
  if (count > 0) return; // Already seeded

  const insertAll = db.transaction(() => {
    // Sub-verticals
    const subverticals = [
      { searchId: 2, name: 'Gebrauchtwagen', slug: 'auto', productId: 40020, adTypeId: 20, urlPath: 'gebrauchtwagen/auto', count: 147785 },
      { searchId: 4, name: 'Motorrad / Quad', slug: 'motorrad', productId: 40021, adTypeId: 21, urlPath: 'gebrauchtwagen/motorrad', count: 40455 },
      { searchId: 50, name: 'Nutzfahrzeug / Pickup', slug: 'nutzfahrzeug', productId: 40025, adTypeId: 25, urlPath: 'gebrauchtwagen/nutzfahrzeuge/nutzfahrzeugboerse', count: 13086 },
      { searchId: 52, name: 'Wohnwagen / Wohnmobile', slug: 'wohnwagen', productId: 40026, adTypeId: 26, urlPath: 'gebrauchtwagen/wohnwagen-wohnmobile/wohnwagenboerse', count: 3869 },
    ];
    for (const sv of subverticals) {
      stmtInsertSubvertical.run(sv);
    }

    // Motorrad categories (MC_CATEGORY)
    const motoCategories = [
      { code: '20', label: 'Chopper / Cruiser', count: 0 },
      { code: '18', label: 'Naked Bike', count: 0 },
      { code: '25', label: 'Supersport', count: 0 },
      { code: '12', label: 'Tourer', count: 0 },
      { code: '1', label: 'Quad', count: 0 },
      { code: '8', label: 'Roller / Scooter', count: 0 },
      { code: '24', label: 'Supermoto', count: 0 },
      { code: '3', label: 'Enduro', count: 0 },
      { code: '19', label: 'Cafe Racer', count: 0 },
      { code: '11', label: 'Rennsport / Rennstrecke', count: 0 },
    ];
    for (const cat of motoCategories) {
      stmtInsertFilterCategory.run({
        subverticalSearchId: 4,
        filterName: 'MC_CATEGORY',
        code: cat.code,
        label: cat.label,
        count: cat.count,
      });
    }

    // Auto body types (CAR_TYPE)
    const autoBodyTypes = [
      { code: 'Klein-/ Kompaktwagen', label: 'Klein-/ Kompaktwagen', count: 0 },
      { code: 'Kombi / Family Van', label: 'Kombi / Family Van', count: 0 },
      { code: 'Sportwagen / Coupé', label: 'Sportwagen / Coupé', count: 0 },
      { code: 'Cabrio / Roadster', label: 'Cabrio / Roadster', count: 0 },
      { code: 'SUV / Geländewagen', label: 'SUV / Geländewagen', count: 0 },
      { code: 'Van / Minibus', label: 'Van / Minibus', count: 0 },
      { code: 'Limousine', label: 'Limousine', count: 0 },
    ];
    for (const bt of autoBodyTypes) {
      stmtInsertFilterCategory.run({
        subverticalSearchId: 2,
        filterName: 'CAR_TYPE',
        code: bt.code,
        label: bt.label,
        count: bt.count,
      });
    }

    // Fuel types (shared across auto + moto + nutzfahrzeug)
    const fuelTypes = [
      { code: '100003', label: 'Diesel' },
      { code: '100004', label: 'Benzin' },
      { code: '100008', label: 'Elektro' },
      { code: '100009', label: 'Hybrid' },
      { code: '100010', label: 'Erdgas (CNG)' },
      { code: '100011', label: 'Autogas (LPG)' },
      { code: '100001', label: 'Benzin (Motorrad)' },
    ];
    for (const fuel of fuelTypes) {
      for (const searchId of [2, 4, 50]) {
        stmtInsertFilterCategory.run({
          subverticalSearchId: searchId,
          filterName: 'ENGINE/FUEL',
          code: fuel.code,
          label: fuel.label,
          count: 0,
        });
      }
    }

    // Transmission types
    const transmissionTypes = [
      { code: '180001', label: 'Schaltgetriebe' },
      { code: '180002', label: 'Automatik' },
    ];
    for (const tr of transmissionTypes) {
      for (const searchId of [2, 50]) {
        stmtInsertFilterCategory.run({
          subverticalSearchId: searchId,
          filterName: 'TRANSMISSION',
          code: tr.code,
          label: tr.label,
          count: 0,
        });
      }
    }

    // Wohnwagen segments
    const caravanSegments = [
      { code: '1', label: 'Wohnwagen' },
      { code: '2', label: 'Wohnmobil' },
    ];
    for (const seg of caravanSegments) {
      stmtInsertFilterCategory.run({
        subverticalSearchId: 52,
        filterName: 'CARAVAN_SEGMENT',
        code: seg.code,
        label: seg.label,
        count: 0,
      });
    }

    // Nutzfahrzeug segments
    const vanSegments = [
      { code: 'Transporter / Kastenwagen', label: 'Transporter / Kastenwagen' },
      { code: 'Pickup', label: 'Pickup' },
      { code: 'LKW', label: 'LKW' },
    ];
    for (const vs of vanSegments) {
      stmtInsertFilterCategory.run({
        subverticalSearchId: 50,
        filterName: 'VAN_SEGMENT',
        code: vs.code,
        label: vs.label,
        count: 0,
      });
    }
  });

  insertAll();
}

export function resolveVehicleFilter(searchId: number, filterName: string, query: string): VehicleFilterCategory | null {
  // Normalize query: lowercase, trim, strip diacritics for fuzzy matching
  const normalized = query.toLowerCase().trim();
  
  // Get all categories for this filter
  const all = getVehicleFilterCategories(searchId, filterName);
  
  // Exact match first (code or label)
  const exact = all.find(c => c.code.toLowerCase() === normalized || c.label.toLowerCase() === normalized);
  if (exact) return exact;
  
  // Partial match: query is contained in label
  const partial = all.find(c => c.label.toLowerCase().includes(normalized));
  if (partial) return partial;
  
  // Reverse: label contains query words
  const words = normalized.split(/\s+/);
  const wordMatch = all.find(c => {
    const lower = c.label.toLowerCase();
    return words.every(w => lower.includes(w));
  });
  if (wordMatch) return wordMatch;
  
  return null;
}

/** Resolve a subvertical by slug or name (e.g. "moto", "motorrad", "auto") */
export function resolveVehicleSubvertical(query: string): VehicleSubvertical | null {
  const all = getVehicleSubverticals();
  const normalized = query.toLowerCase().trim();
  
  // Exact slug match
  const bySlug = all.find(sv => sv.slug === normalized);
  if (bySlug) return bySlug;
  
  // Partial name match
  const byName = all.find(sv => sv.name.toLowerCase().includes(normalized) || normalized.includes(sv.name.toLowerCase()));
  if (byName) return byName;
  
  // Alias matches
  const aliases: Record<string, number> = {
    'auto': 2, 'car': 2, 'gebrauchtwagen': 2, 'pkw': 2,
    'moto': 4, 'motorrad': 4, 'motorbike': 4, 'bike': 4, 'motorräder': 4, 'quad': 4,
    'van': 50, 'nutzfahrzeug': 50, 'lkw': 50, 'pickup': 50, 'transporter': 50,
    'wohnwagen': 52, 'wohnmobil': 52, 'caravan': 52, 'wohnmobile': 52, 'camping': 52,
  };
  const searchId = aliases[normalized];
  if (searchId) return all.find(sv => sv.searchId === searchId) || null;
  
  return null;
}

// --- Wishlist ---

export interface WishlistItem {
  id: number;
  searchQuery: string;
  description: string | null;
  categoryId: number | null;
  priceMax: number | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
}

const stmtGetWishlist = db.prepare(
  'SELECT id, search_query, description, category_id, price_max, notes, active, created_at FROM wishlist WHERE active = 1 ORDER BY created_at DESC'
);
const stmtGetAllWishlist = db.prepare(
  'SELECT id, search_query, description, category_id, price_max, notes, active, created_at FROM wishlist ORDER BY created_at DESC'
);
const stmtInsertWishlist = db.prepare(
  'INSERT INTO wishlist (search_query, description, category_id, price_max, notes) VALUES (@searchQuery, @description, @categoryId, @priceMax, @notes)'
);
const stmtDeleteWishlist = db.prepare('DELETE FROM wishlist WHERE id = ?');
const stmtToggleWishlist = db.prepare('UPDATE wishlist SET active = NOT active WHERE id = ?');

export function getWishlist(activeOnly: boolean = true): WishlistItem[] {
  const rows = (activeOnly ? stmtGetWishlist.all() : stmtGetAllWishlist.all()) as any[];
  return rows.map(row => ({
    id: row.id,
    searchQuery: row.search_query,
    description: row.description,
    categoryId: row.category_id,
    priceMax: row.price_max,
    notes: row.notes,
    active: row.active === 1,
    createdAt: row.created_at,
  }));
}

export function addWishlist(
  searchQuery: string,
  description?: string,
  categoryId?: number,
  priceMax?: number,
  notes?: string,
): WishlistItem {
  const result = stmtInsertWishlist.run({
    searchQuery,
    description: description ?? null,
    categoryId: categoryId ?? null,
    priceMax: priceMax ?? null,
    notes: notes ?? null,
  });
  return {
    id: result.lastInsertRowid as number,
    searchQuery,
    description: description ?? null,
    categoryId: categoryId ?? null,
    priceMax: priceMax ?? null,
    notes: notes ?? null,
    active: true,
    createdAt: new Date().toISOString(),
  };
}

export function removeWishlist(id: number): boolean {
  return stmtDeleteWishlist.run(id).changes > 0;
}

export function toggleWishlist(id: number): boolean {
  return stmtToggleWishlist.run(id).changes > 0;
}
