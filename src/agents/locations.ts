import { load } from "cheerio";
import { checkAuth } from "./auth.js";

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
