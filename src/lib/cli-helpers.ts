/**
 * Shared CLI helper functions — eliminates duplication across commands.
 * All filter-building, arg-parsing, and formatting helpers live here.
 */

import { FALLBACK_LOCATIONS } from "../agents/locations.js";
import type { ImmoFilters } from "../agents/search.js";
import { IMMO_TYPE_MAP } from "../agents/search.js";

// ─── Filter Building ─────────────────────────────────────────────────────

export interface ImmoFilterResult {
  filters: ImmoFilters | undefined;
  searchId: number | undefined;
  isImmo: boolean;
}

/**
 * Build server-side ImmoFilters from CLI flags.
 * Returns filters + resolved searchId if --type maps to one.
 * Used by search, analyze, and overview commands — single source of truth.
 */
export function buildImmoFilters(flags: Record<string, string | boolean>): ImmoFilterResult {
  const vertical = typeof flags.vertical === "string" ? flags.vertical : undefined;
  const isImmo = vertical === "immobilien" || vertical === "wohnungen" || vertical === "hauser";

  if (!isImmo) return { filters: undefined, searchId: undefined, isImmo: false };

  const maxPrice = numFlag(flags, "max-price");
  const minPrice = numFlag(flags, "min-price");
  const minSize = numFlag(flags, "min-size");
  const maxSize = numFlag(flags, "max-size");
  const rooms = intFlag(flags, "rooms");
  const propertyType = strFlag(flags, "type");

  const filters: ImmoFilters = {};
  if (maxPrice !== undefined) filters.priceTo = maxPrice;
  if (minPrice !== undefined) filters.priceFrom = minPrice;
  if (minSize !== undefined) filters.estateSizeFrom = minSize;
  if (maxSize !== undefined) filters.estateSizeTo = maxSize;
  if (rooms !== undefined) filters.rooms = rooms;

  let searchId: number | undefined;
  if (propertyType) {
    const mapped = IMMO_TYPE_MAP[propertyType.toLowerCase()];
    if (mapped) {
      searchId = mapped;
    } else {
      filters.propertyType = propertyType;
    }
  }

  return {
    filters: Object.keys(filters).length > 0 ? filters : undefined,
    searchId,
    isImmo: true,
  };
}

// ─── Area / Location Helpers ─────────────────────────────────────────────

/**
 * Parse --location flag into areaId array.
 */
export function parseAreaIds(flags: Record<string, string | boolean>): number[] | undefined {
  const loc = strFlag(flags, "location");
  if (!loc) return undefined;
  return loc.split(",").map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
}

/**
 * Resolve areaIds to named entries using FALLBACK_LOCATIONS.
 * Falls back to raw ID for unknown areas.
 */
export function resolveAreaNames(areaIds: number[]): { areaId: number; name: string }[] {
  return areaIds.map(id => ({
    areaId: id,
    name: FALLBACK_LOCATIONS[id] || `areaId ${id}`,
  }));
}

/**
 * Get all child areas for a parent Bundesland (e.g. 900 = Wien → all Bezirke).
 * Works generically for any parent that has named children with a common prefix.
 */
export function getChildAreas(parentId: number): { areaId: number; name: string }[] {
  const parentName = FALLBACK_LOCATIONS[parentId];
  if (!parentName) return [];

  const prefix = parentName + " ";
  const children: { areaId: number; name: string }[] = [];

  for (const [id, name] of Object.entries(FALLBACK_LOCATIONS)) {
    if (name.startsWith(prefix)) {
      children.push({ areaId: Number(id), name });
    }
  }

  children.sort((a, b) => a.name.localeCompare(b.name, "de"));
  return children;
}

/**
 * Check if an areaId is a top-level Bundesland (id < 1000) or a sub-area.
 */
export function isBundesland(areaId: number): boolean {
  return areaId < 1000;
}

// ─── Formatting Helpers ──────────────────────────────────────────────────

/**
 * Format a number for display (German locale).
 */
export const fmtNum = (n: number | null): string =>
  n !== null ? n.toLocaleString("de-AT") : "—";

/**
 * Format a number as currency.
 */
export const fmtCur = (n: number | null): string =>
  n !== null ? `€ ${n.toLocaleString("de-AT")}` : "—";

/**
 * Format a number as €/m².
 */
export const fmtPpm2 = (n: number | null): string =>
  n !== null ? `${n.toLocaleString("de-AT")}/m²` : "—";

// ─── Flag Parsing Utilities ──────────────────────────────────────────────

/** Get a string flag value. */
export function strFlag(flags: Record<string, string | boolean>, key: string): string | undefined {
  const v = flags[key];
  return typeof v === "string" ? v : undefined;
}

/** Get a numeric flag value (float). */
export function numFlag(flags: Record<string, string | boolean>, key: string): number | undefined {
  const v = flags[key];
  if (typeof v !== "string") return undefined;
  const n = parseFloat(v);
  return isNaN(n) ? undefined : n;
}

/** Get an integer flag value. */
export function intFlag(flags: Record<string, string | boolean>, key: string): number | undefined {
  const v = flags[key];
  if (typeof v !== "string") return undefined;
  const n = parseInt(v, 10);
  return isNaN(n) ? undefined : n;
}

/** Check if a boolean flag is set. */
export function boolFlag(flags: Record<string, string | boolean>, key: string): boolean {
  return flags[key] === true;
}
