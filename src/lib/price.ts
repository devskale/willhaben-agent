/**
 * Robust price & area utilities for Immobilien listings.
 * Uses @norbulcz/num-parse for number parsing — never let the LLM do math.
 */
import { parseNumber } from "@norbulcz/num-parse";

/**
 * Clean a raw price string from willhaben into a number.
 *
 * Handles:
 *   "€ 249.999"        → 249999
 *   "ab € 184.680"     → 184680
 *   "€ 1.234.567"      → 1234567
 *   "250000"           → 250000
 *   "" / null          → null
 */
export function parsePrice(raw: string | number | null | undefined): number | null {
  if (typeof raw === "number") return isNaN(raw) || !isFinite(raw) ? null : raw;
  if (!raw || typeof raw !== "string") return null;

  // Strip willhaben-specific prefixes
  const cleaned = raw
    .replace(/^ab\s*/i, "")
    .replace(/\u00a0/g, " "); // nbsp → space

  return parseNumber(cleaned);
}

/**
 * Clean a raw estate-size string into m² (number).
 *
 * Handles:
 *   "72 m²"            → 72
 *   "72m²"             → 72
 *   "72,5"             → 72.5
 *   "" / null / 0      → null
 */
export function parseEstateSize(raw: string | number | null | undefined): number | null {
  if (typeof raw === "number") {
    if (isNaN(raw) || !isFinite(raw) || raw <= 0) return null;
    return raw;
  }
  if (!raw || typeof raw !== "string") return null;

  // Strip m² suffix (willhaben sends bare numbers too)
  const cleaned = raw.replace(/m²/gi, "").replace(/m2/gi, "").trim();

  const result = parseNumber(cleaned);
  if (result === null || result <= 0) return null;
  return result;
}

/**
 * Parse room count from willhaben raw value.
 *
 * Handles:
 *   "3X3"              → "3"
 *   "3"                → "3"
 *   "0" / "" / null    → null (hide garbage)
 *
 * Uses num-parse for safety, keeps only domain-specific "3X" splitting.
 */
export function parseRooms(raw: string | number | null | undefined): string | null {
  if (typeof raw === "number") return raw > 0 ? String(raw) : null;
  if (!raw || typeof raw !== "string") return null;

  // willhaben sometimes sends "3X3" meaning 3 rooms, 3 something-else
  const parts = raw.split(/[xX]/);
  const first = parts[0].trim();

  // Use num-parse for robustness
  const n = parseNumber(first);
  if (n === null || n <= 0) return null;
  return String(n);
}

/**
 * Compute €/m² safely. Returns null if inputs are invalid.
 * Result rounded to nearest integer.
 */
export function computePricePerSqm(
  price: number | null | undefined,
  sizeM2: number | null | undefined,
): number | null {
  if (price == null || sizeM2 == null || sizeM2 <= 0 || price <= 0) return null;
  return Math.round(price / sizeM2);
}

/**
 * Format €/m² for display.
 */
export function formatPricePerSqm(value: number | null): string {
  if (value === null) return "";
  return `€${value.toLocaleString("de-AT")}/m²`;
}
