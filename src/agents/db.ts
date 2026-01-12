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
    category_id TEXT,
    category_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migration: Ensure query is unique
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
  categoryId?: string;
  categoryName?: string;
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
  }));
}

const stmtInsertHistory = db.prepare(`
  INSERT INTO search_history (query, category_id, category_name, created_at)
  VALUES (@query, @categoryId, @categoryName, CURRENT_TIMESTAMP)
  ON CONFLICT(query) DO UPDATE SET
    category_id = excluded.category_id,
    category_name = excluded.category_name,
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
  categoryId?: string,
  categoryName?: string
) {
  // Validation: Not empty and min length 2
  if (!query || query.trim().length < 2) {
    return;
  }

  stmtInsertHistory.run({
    query: query.trim(),
    categoryId: categoryId || null,
    categoryName: categoryName || null,
  });
  stmtTrimHistory.run();
}

export function getSearchHistory(): SearchHistoryItem[] {
  const rows = stmtListHistory.all() as any[];
  return rows.map((row) => ({
    id: row.id,
    query: row.query,
    categoryId: row.category_id || undefined,
    categoryName: row.category_name || undefined,
    createdAt: row.created_at,
  }));
}
