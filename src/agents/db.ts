import { Database } from "bun:sqlite";
import { Listing } from "../types.js";
import path from "path";

// Initialize DB path
const dbPath = path.resolve(process.cwd(), "willhaben.db");

// Lazy initialization
let db: Database | null = null;

function getDb(): Database {
  if (!db) {
    db = new Database(dbPath);
    initializeDb(db);
  }
  return db;
}

function initializeDb(database: Database) {
  database.run(`
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

  database.run(`
    CREATE TABLE IF NOT EXISTS search_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL,
      category_id TEXT,
      category_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    database.run(`
      DELETE FROM search_history 
      WHERE id NOT IN (
        SELECT MAX(id) FROM search_history GROUP BY query
      )
    `);
    database.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_search_history_query ON search_history(query)
    `);
  } catch {
    // Ignore index errors
  }
}

export interface StarredItem extends Listing {
  starredAt: string;
}

export interface SearchHistoryItem {
  id: number;
  query: string;
  categoryId?: string;
  categoryName?: string;
  createdAt: string;
}

export function toggleStar(item: Listing): boolean {
  const database = getDb();
  
  // Check if starred
  const checkStmt = database.prepare("SELECT 1 FROM starred_items WHERE id = ?");
  const isStarred = checkStmt.get(item.id);

  if (isStarred) {
    const deleteStmt = database.prepare("DELETE FROM starred_items WHERE id = ?");
    deleteStmt.run(item.id);
    return false;
  } else {
    const insertStmt = database.prepare(`
      INSERT INTO starred_items (id, title, price, price_text, location, description, url, condition, seller_name, paylivery)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertStmt.run(
      item.id,
      item.title,
      item.price,
      item.priceText,
      item.location,
      item.description,
      item.url,
      item.condition,
      item.sellerName,
      item.paylivery ? 1 : 0
    );
    return true;
  }
}

export function isStarred(id: string): boolean {
  const database = getDb();
  const stmt = database.prepare("SELECT 1 FROM starred_items WHERE id = ?");
  return !!stmt.get(id);
}

export function getStarredItems(): StarredItem[] {
  const database = getDb();
  const stmt = database.prepare("SELECT * FROM starred_items ORDER BY created_at DESC");
  const rows = stmt.all() as any[];
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
  }));
}

export function addSearchHistory(query: string, categoryId?: string, categoryName?: string) {
  if (!query || query.trim().length < 2) return;
  
  const database = getDb();
  
  const insertStmt = database.prepare(`
    INSERT INTO search_history (query, category_id, category_name, created_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(query) DO UPDATE SET
      category_id = excluded.category_id,
      category_name = excluded.category_name,
      created_at = excluded.created_at
  `);
  insertStmt.run(query.trim(), categoryId || null, categoryName || null);
  
  const trimStmt = database.prepare(`
    DELETE FROM search_history WHERE id NOT IN (
      SELECT id FROM search_history ORDER BY created_at DESC LIMIT 100
    )
  `);
  trimStmt.run();
}

export function getSearchHistory(): SearchHistoryItem[] {
  const database = getDb();
  const stmt = database.prepare("SELECT * FROM search_history ORDER BY created_at DESC");
  const rows = stmt.all() as any[];
  return rows.map((row) => ({
    id: row.id,
    query: row.query,
    categoryId: row.category_id || undefined,
    categoryName: row.category_name || undefined,
    createdAt: row.created_at,
  }));
}
