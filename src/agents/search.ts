/**
 * Search — thin orchestrator.
 *
 * Delegates to:
 *   - search-marktplatz.ts  → Marktplatz, Auto (vertical 5, 3)
 *   - search-immo.ts        → Immobilien (vertical 2)
 *
 * Each domain is fully self-contained. This file only routes + re-exports.
 */

// ─── Re-exports: Marktplatz ──────────────────────────────────────────────
export {
  searchMarktplatz,
  fetchMarktplatzApi,
  getMarktplatzCategoryTree,
  getListingDetails,
  getSeller,
  getListingImages,
  parseApiAttributes,
  MARKTPLATZ_VERTICALS,
  resolveMarktplatzVertical,
  type MarktplatzVertical,
  type MarktplatzApiItem,
  type ListingImage,
  type ListingWithImages,
} from "./search-marktplatz.js";

// ─── Re-exports: Immo ────────────────────────────────────────────────────
export {
  searchImmo,
  fetchImmoApi,
  getImmoOverview,
  parseImmoItem,
  parseImmoAttributes,
  IMMO_TYPE_MAP,
  IMMO_VERTICALS,
  resolveImmoVertical,
  type ImmoFilters,
  type ImmoApiItem,
  type ImmoVerticalConfig,
  type ImmoSearchResult,
  type DistrictStats,
} from "./search-immo.js";

// ─── Imports for routing logic ───────────────────────────────────────────
import { searchMarktplatz } from "./search-marktplatz.js";
import { searchImmo as _searchImmo } from "./search-immo.js";
import { resolveImmoVertical } from "./search-immo.js";
import { getMarktplatzCategoryTree } from "./search-marktplatz.js";
import type { SearchResult, CategoryTree } from "../types.js";
import type { ImmoFilters } from "./search-immo.js";

// Also re-export ImmoFilters at top level for cli-helpers
// (already exported above in the immo block)

/**
 * Main search entry point — routes to correct domain by verticalKey.
 */
export const searchItems = async (
  keyword: string,
  categoryId?: string,
  page?: number,
  areaIds?: number[],
  verticalKey?: string,
  immoFilters?: ImmoFilters,
  immoSearchId?: number,
): Promise<SearchResult> => {
  const immoVc = resolveImmoVertical(verticalKey);

  if (immoVc) {
    const result = await _searchImmo(immoSearchId || immoVc.searchId, areaIds, 30, immoFilters);
    return { ...result, categories: [] };
  }

  return searchMarktplatz(keyword, verticalKey, categoryId, page, areaIds);
};

/** Category tree — marktplatz domain. */
export const getCategoryTree = async (
  categoryId?: string,
  keyword?: string,
): Promise<CategoryTree> => getMarktplatzCategoryTree(categoryId, keyword);
