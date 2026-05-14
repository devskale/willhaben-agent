import { load } from "cheerio";
import { checkAuth } from "./auth.js";
import { getSubRegions } from "./db.js";

const BASE_URL = "https://www.willhaben.at";

export interface LocationNode {
  id?: number;
  name: string;
  children?: LocationNode[];
}

export const FALLBACK_LOCATIONS: Record<number, string> = {
  1: "Burgenland",
  2: "Kärnten",
  3: "Niederösterreich",
  4: "Oberösterreich",
  5: "Salzburg",
  6: "Steiermark",
  7: "Tirol",
  8: "Vorarlberg",
  900: "Wien",
  // Wien Bezirke (areaId = LOCATION_ID from API)
  117223: "Wien 01. Innere Stadt",
  117224: "Wien 02. Leopoldstadt",
  117225: "Wien 03. Landstraße",
  117226: "Wien 04. Wieden",
  117227: "Wien 05. Margareten",
  117228: "Wien 06. Mariahilf",
  117229: "Wien 07. Neubau",
  117230: "Wien 08. Josefstadt",
  117231: "Wien 09. Alsergrund",
  117232: "Wien 10. Favoriten",
  117233: "Wien 11. Simmering",
  117234: "Wien 12. Meidling",
  117235: "Wien 13. Hietzing",
  117236: "Wien 14. Penzing",
  117237: "Wien 15. Rudolfsheim-Fünfhaus",
  117238: "Wien 16. Ottakring",
  117239: "Wien 17. Hernals",
  117240: "Wien 18. Währing",
  117241: "Wien 19. Döbling",
  117242: "Wien 20. Brigittenau",
  117243: "Wien 21. Floridsdorf",
  117244: "Wien 22. Donaustadt",
  117245: "Wien 23. Liesing",
};

const getHeaders = (cookies: string) => ({
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Cookie: cookies,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "de-AT,de;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache, no-store, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
});

const extractAreaId = (value: any): number | undefined => {
  const direct = value?.value;
  if (typeof direct === "number" && Number.isFinite(direct)) return direct;
  if (typeof direct === "string" && direct.trim()) {
    const parsed = Number(direct);
    if (Number.isFinite(parsed)) return parsed;
  }

  const params = value?.urlParamRepresentationForValue || value?.urlParamRepresentationForValueList;
  if (Array.isArray(params)) {
    const match = params.find((p: any) =>
      typeof p?.urlParameterName === "string" &&
      p.urlParameterName.toLowerCase().includes("area")
    );
    if (match?.value !== undefined) {
      const parsed = Number(match.value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return undefined;
};

const normalizeValues = (values: any[]): LocationNode[] => {
  return values
    .map((val) => ({
      id: extractAreaId(val),
      name: val.label || val.name || val.value || "Unknown",
    }))
    .filter((node) => node.name);
};

const normalizeGroupedValues = (grouped: any[]): LocationNode[] => {
  return grouped.map((group) => {
    const children = normalizeValues(group.possibleValues || []);
    return {
      name: group.label || group.name || "Region",
      children,
    };
  });
};

const collectNavigatorGroups = (navigatorGroups: any[]): any[] => {
  const groups: any[] = [];
  for (const group of navigatorGroups || []) {
    groups.push(group);
    if (Array.isArray(group.navigatorList)) {
      groups.push(...group.navigatorList);
    }
  }
  return groups;
};

const isLocationGroup = (group: any): boolean => {
  const id = String(group?.id || "").toLowerCase();
  const name = String(group?.name || group?.label || "").toLowerCase();
  return (
    id.includes("area") ||
    id.includes("region") ||
    id.includes("location") ||
    name.includes("bundesland") ||
    name.includes("bezirk") ||
    name.includes("region")
  );
};

const buildFallbackTree = (): LocationNode[] => {
  return Object.entries(FALLBACK_LOCATIONS).map(([id, name]) => ({
    id: Number(id),
    name,
  }));
};

export const buildLocationMap = (nodes: LocationNode[]): Record<number, string> => {
  const map: Record<number, string> = {};
  const walk = (list: LocationNode[]) => {
    for (const node of list) {
      if (node.id !== undefined) map[node.id] = node.name;
      if (node.children) walk(node.children);
    }
  };
  walk(nodes);
  return map;
};

/**
 * Resolve location input (name or ID) → array of areaIds.
 * Supports: numbers, names, fuzzy match, partial match.
 * Searches: DB regions → FALLBACK_LOCATIONS.
 * 
 * Examples:
 *   "900" → [900]
 *   "wien" → [900]
 *   "neusiedl" → [107]  (Bezirk Neusiedl am See, parent=1 Burgenland)
 *   "1020" → [117224]  (Wien 02. Leopoldstadt)
 *   "wien,1,3" → [900, 1, 3]
 */
export function resolveLocationInput(input: string): { areaIds: number[]; resolved: { input: string; areaId: number; name: string }[] } {
  const parts = input.split(',').map(s => s.trim()).filter(Boolean);
  const areaIds: number[] = [];
  const resolved: { input: string; areaId: number; name: string }[] = [];

  for (const part of parts) {
    // Try as number first
    const num = Number(part);
    if (!isNaN(num) && Number.isFinite(num)) {
      // Check if it's a known areaId
      const fallbackName = FALLBACK_LOCATIONS[num];
      const dbName = lookupDbByAreaId(num);
      if (fallbackName || dbName) {
        areaIds.push(num);
        resolved.push({ input: part, areaId: num, name: fallbackName || dbName! });
        continue;
      }
      // Not a known areaId — try as PLZ
      const plzMatch = plzToLocation(String(part));
      if (plzMatch) {
        areaIds.push(plzMatch.areaId);
        resolved.push({ input: part, areaId: plzMatch.areaId, name: plzMatch.name });
        continue;
      }
      // Truly unknown number
      areaIds.push(num);
      resolved.push({ input: part, areaId: num, name: `unknown (${part})` });
      continue;
    }

    // Try name match (case-insensitive)
    const match = findLocationByName(part);
    if (match) {
      areaIds.push(match.areaId);
      resolved.push({ input: part, areaId: match.areaId, name: match.name });
    } else {
      // Fallback: treat as number
      areaIds.push(num);
      resolved.push({ input: part, areaId: num, name: `unknown (${part})` });
    }
  }

  return { areaIds, resolved };
}

function lookupDbByAreaId(areaId: number): string | undefined {
  try {
    // Check all Bundesland parent IDs (1-8, 900)
    const states = [1, 2, 3, 4, 5, 6, 7, 8, 900];
    for (const stateId of states) {
      const regions = getSubRegions(stateId);
      const found = regions.find(r => r.areaId === areaId);
      if (found) return found.name;
    }
  } catch { /* DB not available */ }
  return undefined;
}

function findLocationByName(query: string): { areaId: number; name: string } | undefined {
  const q = query.toLowerCase().trim();
  
  // 1. Exact match in FALLBACK_LOCATIONS
  for (const [id, name] of Object.entries(FALLBACK_LOCATIONS)) {
    if (name.toLowerCase() === q) return { areaId: Number(id), name };
  }

  // 2. Exact match in DB regions
  const dbMatch = findInDb(q, true);
  if (dbMatch) return dbMatch;

  // 3. PLZ match (e.g. "1020" → Wien 02.)
  if (/^\d{4}$/.test(q)) {
    const plz = q;
    // Wien Bezirke: PLZ 1010-1230 → Bezirke 1-23
    const wienMatch = plzToLocation(plz);
    if (wienMatch) return wienMatch;
  }

  // 4. Partial match in FALLBACK_LOCATIONS
  for (const [id, name] of Object.entries(FALLBACK_LOCATIONS)) {
    if (name.toLowerCase().includes(q)) return { areaId: Number(id), name };
  }

  // 5. Partial match in DB
  return findInDb(q, false);
}

function findInDb(query: string, exact: boolean): { areaId: number; name: string } | undefined {
  try {
    const states = [1, 2, 3, 4, 5, 6, 7, 8, 900];
    for (const stateId of states) {
      const regions = getSubRegions(stateId);
      for (const r of regions) {
        const name = r.name.toLowerCase();
        if (exact ? name === query : name.includes(query)) {
          return { areaId: r.areaId, name: r.name };
        }
      }
    }
  } catch { /* DB not available */ }
  return undefined;
}

function plzToLocation(plz: string): { areaId: number; name: string } | undefined {
  // Wien PLZs: 1010=1., 1020=2., ... 1090=9., 1100=10., 1110=11., ... 1230=23.
  const num = parseInt(plz, 10);
  const wienBezirk = (num - 1000) / 10;
  if (wienBezirk >= 1 && wienBezirk <= 23 && Number.isInteger(wienBezirk)) {
    const areaId = 117222 + wienBezirk; // 117223..117245
    const name = FALLBACK_LOCATIONS[areaId];
    if (name) return { areaId, name };
  }
  // For non-Wien PLZs, try to find a DB region whose name starts with the PLZ
  // (e.g. some regions are stored as "7100 Neusiedl am See")
  try {
    const states = [1, 2, 3, 4, 5, 6, 7, 8, 900];
    for (const stateId of states) {
      const regions = getSubRegions(stateId);
      for (const r of regions) {
        if (r.name.startsWith(plz + ' ') || r.name.startsWith(plz)) {
          return { areaId: r.areaId, name: r.name };
        }
      }
    }
  } catch { /* DB not available */ }
  return undefined;
}

export async function getLocationHierarchy(): Promise<LocationNode[]> {
  const { cookies } = await checkAuth();
  const headers = getHeaders(cookies);
  const url = `${BASE_URL}/iad/kaufen-und-verkaufen/marktplatz/`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    return buildFallbackTree();
  }

  const html = await response.text();
  const $ = load(html);
  const nextData = $("#__NEXT_DATA__").html();
  if (!nextData) {
    return buildFallbackTree();
  }

  const data = JSON.parse(nextData);
  const searchResult = data.props?.pageProps?.searchResult;
  const navigatorGroups = collectNavigatorGroups(searchResult?.navigatorGroups || []);
  const locationGroup = navigatorGroups.find(isLocationGroup);

  if (!locationGroup) {
    return buildFallbackTree();
  }

  if (locationGroup.groupedPossibleValues?.length) {
    return normalizeGroupedValues(locationGroup.groupedPossibleValues);
  }

  if (locationGroup.values?.length) {
    return normalizeValues(locationGroup.values);
  }

  if (locationGroup.possibleValues?.length) {
    return normalizeValues(locationGroup.possibleValues);
  }

  return buildFallbackTree();
}
