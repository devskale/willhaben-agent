/**
 * Vehicle search — Auto, Motorrad, Nutzfahrzeug, Wohnwagen.
 *
 * All share vertical 3, different searchIds.
 * Uses DB-backed category resolution for natural language queries
 * like "enduro", "chopper", "elektro", "automatik".
 */

import {
  getVehicleSubverticals,
  resolveVehicleSubvertical,
  resolveVehicleFilter,
  type VehicleSubvertical,
} from "./db.js";

import { WH_CLIENT, UA } from '../lib/constants.js';
import { getPublicHeaders } from '../lib/http.js';
const BASE = "https://www.willhaben.at/webapi/ad-search/search/atz/3";

export interface VehicleFilters {
  keyword?: string;
  priceFrom?: number;
  priceTo?: number;
  yearFrom?: number;
  yearTo?: number;
  mileageTo?: number;
  mileageFrom?: number;
  fuel?: string;       // resolved label or code
  transmission?: string; // resolved label or code
  category?: string;   // MC_CATEGORY label or code, CAR_TYPE, etc.
  areaIds?: number[];
  isPrivate?: boolean;
  rows?: number;
  page?: number;
}

export interface VehicleListing {
  id: string;
  heading: string;
  price: number | null;
  priceText: string;
  make: string;
  model: string;
  spec: string;
  yearModel: string;
  mileage: string;
  engineKw: string;
  fuel: string;
  transmission: string;
  vehicleType: string;
  location: string;
  imageUrl: string;
  isPrivate: boolean;
  hasConditionReport: boolean;
  url: string;
}

export interface VehicleSearchResult {
  items: VehicleListing[];
  totalFound: number;
  subvertical: VehicleSubvertical;
  resolvedFilters: Record<string, string>;
}

// ─── Parse attributes from API item ─────────────────────────────────────

function getAttr(attrs: Record<string, string[]>, name: string): string {
  return attrs[name]?.[0] || "";
}

// ─── Build query params ──────────────────────────────────────────────────

async function buildVehicleParams(
  filters: VehicleFilters,
  subvertical: VehicleSubvertical,
): Promise<{ params: string; resolved: Record<string, string> }> {
  const parts: string[] = [];
  const resolved: Record<string, string> = {};

  const rows = filters.rows || 30;
  const page = filters.page || 1;
  parts.push(`rows=${rows}`);
  parts.push(`PAGE=${page}`);

  if (filters.keyword) {
    parts.push(`keyword=${encodeURIComponent(filters.keyword)}`);
  }
  if (filters.priceFrom !== undefined) parts.push(`PRICE_FROM=${filters.priceFrom}`);
  if (filters.priceTo !== undefined) parts.push(`PRICE_TO=${filters.priceTo}`);
  if (filters.yearFrom !== undefined) parts.push(`YEAR_MODEL_FROM=${filters.yearFrom}`);
  if (filters.yearTo !== undefined) parts.push(`YEAR_MODEL_TO=${filters.yearTo}`);
  if (filters.mileageFrom !== undefined) parts.push(`MILEAGE_FROM=${filters.mileageFrom}`);
  if (filters.mileageTo !== undefined) parts.push(`MILEAGE_TO=${filters.mileageTo}`);
  if (filters.areaIds?.length) {
    for (const aid of filters.areaIds) parts.push(`areaId=${aid}`);
  }
  if (filters.isPrivate !== undefined) parts.push(`ISPRIVATE=${filters.isPrivate ? '1' : '0'}`);

  // Resolve named filters from DB
  const sid = subvertical.searchId;

  // Category filter (MC_CATEGORY for moto, CAR_TYPE for auto, etc.)
  if (filters.category) {
    const filterName = sid === 4 ? "MC_CATEGORY" : sid === 2 ? "CAR_TYPE" : sid === 50 ? "VAN_SEGMENT" : "CARAVAN_SEGMENT";
    const cat = resolveVehicleFilter(sid, filterName, filters.category);
    if (cat) {
      parts.push(`${filterName}=${encodeURIComponent(cat.code)}`);
      resolved[filterName] = `${cat.label} (${cat.code})`;
    }
  }

  // Fuel filter
  if (filters.fuel) {
    const fuel = resolveVehicleFilter(sid, "ENGINE/FUEL", filters.fuel);
    if (fuel) {
      parts.push(`ENGINE/FUEL=${fuel.code}`);
      resolved["ENGINE/FUEL"] = `${fuel.label} (${fuel.code})`;
    }
  }

  // Transmission filter
  if (filters.transmission) {
    const tr = resolveVehicleFilter(sid, "TRANSMISSION", filters.transmission);
    if (tr) {
      parts.push(`TRANSMISSION=${tr.code}`);
      resolved["TRANSMISSION"] = `${tr.label} (${tr.code})`;
    }
  }

  return { params: parts.join("&"), resolved };
}

// ─── Main search function ────────────────────────────────────────────────

export async function searchVehicles(
  subverticalQuery: string,
  filters: VehicleFilters = {},
): Promise<VehicleSearchResult> {
  const subvertical = resolveVehicleSubvertical(subverticalQuery);
  if (!subvertical) {
    const available = getVehicleSubverticals().map(sv => sv.slug).join(", ");
    throw new Error(`Unknown vehicle type "${subverticalQuery}". Available: ${available}`);
  }

  const { headers } = await getPublicHeaders();
  const { params, resolved } = await buildVehicleParams(filters, subvertical);

  const url = `${BASE}/${subvertical.searchId}/atverz?${params}`;

  const resp = await fetch(url, {
    headers,
  });

  if (!resp.ok) {
    throw new Error(`Vehicle search failed: ${resp.status} ${resp.statusText}`);
  }

  const data = await resp.json() as any;
  const items = data.advertSummary || data.advertSummaryList?.advertSummary || [];
  const totalFound = data.rowsFound || items.length;

  const listings: VehicleListing[] = items.map((item: any) => {
    const a: Record<string, string[]> = {};
    for (const attr of item.attributes?.attribute || []) {
      a[attr.name] = attr.values || [];
    }

    const heading = getAttr(a, "HEADING") || item.description || "";
    const price = parseFloat(getAttr(a, "PRICE")) || null;
    const priceText = getAttr(a, "PRICE_FOR_DISPLAY") || (price !== null ? `€ ${price}` : "");

    // Make/model — different prefixes per subvertical
    const make = getAttr(a, "CAR_MODEL/MAKE") || getAttr(a, "MC_MODEL/MAKE") || getAttr(a, "VAN_MODEL/MAKE") || getAttr(a, "CARAVAN_MODEL/MAKE") || "";
    const model = getAttr(a, "CAR_MODEL/MODEL") || getAttr(a, "MC_MODEL/MODEL") || getAttr(a, "VAN_MODEL/MODEL") || getAttr(a, "CARAVAN_MODEL/MODEL") || "";
    const spec = getAttr(a, "CAR_MODEL/MODEL_SPECIFICATION") || getAttr(a, "MC_MODEL/MODEL_SPECIFICATION") || "";

    const engineVolume = getAttr(a, "ENGINEVOLUME");

    return {
      id: String(item.id),
      heading,
      price,
      priceText,
      make,
      model,
      spec,
      yearModel: getAttr(a, "YEAR_MODEL"),
      mileage: getAttr(a, "MILEAGE"),
      engineKw: getAttr(a, "ENGINE/EFFECT"),
      fuel: getAttr(a, "ENGINE/FUEL_RESOLVED"),
      transmission: getAttr(a, "TRANSMISSION_RESOLVED"),
      vehicleType: getAttr(a, "CAR_TYPE") || getAttr(a, "MC_CATEGORY_RESOLVED") || getAttr(a, "VAN_SEGMENT") || getAttr(a, "CARAVAN_SEGMENT_RESOLVED") || "",
      location: [getAttr(a, "POSTCODE"), getAttr(a, "LOCATION")].filter(Boolean).join(", "),
      imageUrl: item.advertImageList?.advertImage?.[0]?.mainImageUrl || "",
      isPrivate: getAttr(a, "ISPRIVATE") === "1",
      hasConditionReport: getAttr(a, "CONDITION_REPORT") === "1",
      url: `https://www.willhaben.at/iad/object?adId=${item.id}`,
      ...(engineVolume ? { engineVolume } : {}),
    } as VehicleListing & { engineVolume?: string };
  });

  return { items: listings, totalFound, subvertical, resolvedFilters: resolved };
}
