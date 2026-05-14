/**
 * Search — thin orchestrator.
 *
 * Delegates to:
 *   - search-marktplatz.ts  → Marktplatz, Auto (vertical 5, 3)
 *   - search-immo.ts        → Immobilien (vertical 2)
 *
 * Each domain is fully self-contained. This file only routes + re-exports
 * what the CLI actually needs.
 */

// ─── Re-exports used by cli.ts / cli-helpers.ts / tests ──────────────────
export {
  getListingDetails,
  getSeller,
  getListingImages,
  CONDITION_MAP,
  type MarktplatzFilters,
} from "./search-marktplatz.js";

export {
  getImmoOverview,
  IMMO_TYPE_MAP,
} from "./search-immo.js";

export type { ImmoFilters } from "./search-immo.js";

// ─── Routing logic ───────────────────────────────────────────────────────
import { searchMarktplatz, getListingDetails as _getDetails, type MarktplatzFilters } from "./search-marktplatz.js";
import { searchImmo as _searchImmo, resolveImmoVertical } from "./search-immo.js";
import { getMarktplatzCategoryTree } from "./search-marktplatz.js";
import type { Listing, SearchResult, CategoryTree } from "../types.js";
import type { ImmoFilters } from "./search-immo.js";

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
  marktplatzFilters?: MarktplatzFilters,
  maxPages: number = 1,
): Promise<SearchResult> => {
  const immoVc = resolveImmoVertical(verticalKey);

  if (immoVc) {
    const result = await _searchImmo(immoSearchId || immoVc.searchId, areaIds, 30, immoFilters, maxPages);
    return { ...result, categories: [] };
  }

  return searchMarktplatz(keyword, verticalKey, categoryId, page, areaIds, marktplatzFilters, maxPages);
};

/** Category tree — marktplatz domain. */
export const getCategoryTree = async (
  categoryId?: string,
  keyword?: string,
): Promise<CategoryTree> => getMarktplatzCategoryTree(categoryId, keyword);

/**
 * Enrich listings with descriptions by fetching detail pages in parallel batches.
 * Modifies items in place (fills item.description).
 */
export const enrichDescriptions = async (
  items: Listing[],
  concurrency: number = 10,
): Promise<void> => {
  const batchSize = concurrency;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map(async (item) => {
        if (item.description) return; // already has description
        try {
          const details = await _getDetails(item.id);
          if (details.fullDescription) {
            // Strip HTML tags for plain text
            item.description = details.fullDescription
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
          }
        } catch {
          // Skip failed detail fetches
        }
      })
    );
  }
};
