/**
 * Willhaben API Response Types
 *
 * Reverse-engineered from live API traffic (2026-05).
 * These types reflect the actual JSON shapes returned by willhaben's internal APIs.
 *
 * Naming convention: `{Endpoint}Response` for top-level, `{Entity}Item` for list items.
 *
 * @see api.md for endpoint documentation
 */

// ─── Shared Primitives ──────────────────────────────────────────────────

/** Key-value attribute pair — the core data format for all advert data. */
export interface ApiAttribute {
  name: string;
  values: string[];
}

/** Attribute container — appears in every advert (summary and detail). */
export interface ApiAttributeList {
  attribute: ApiAttribute[];
}

/** Image metadata for a single photo. */
export interface ApiAdvertImage {
  id: number;
  name: string;               // e.g. "1/991/868/131_662553375.jpg"
  selfLink: string;
  description: string;         // e.g. "Cover Image"
  mainImageUrl: string;        // _hoved variant (~942×1200)
  thumbnailImageUrl: string;   // _thumb variant
  referenceImageUrl: string;   // original variant
  similarImageSearchUrl: string | null;
  reference: string;           // same as name
}

/** Image container — appears in every advert. */
export interface ApiAdvertImageList {
  advertImage?: ApiAdvertImage[];
  floorPlans?: unknown[];      // only on Immobilien listings
}

/** HATEOAS-style link — every response includes self-describing API links. */
export interface ApiContextLink {
  id: string;                  // e.g. "selfLink", "adDetailLink", "removeAdFromFolder"
  description?: string;
  uri: string;
  selected?: boolean;
  relativePath?: string;
  serviceName?: string;
}

/** Container for context links. */
export interface ApiContextLinkList {
  contextLink: ApiContextLink[];
}

/** Advert status — appears in every advert. */
export interface ApiAdvertStatus {
  id: string;                  // "active"
  description: string;         // "aktiv"
  statusId: number;            // 50
}

/** Pre-formatted teaser line (e.g. "2024 EZ", "10.000 km", "150 PS (110 kW)"). */
export interface ApiTeaserAttribute {
  prefix: string | null;
  value: string;
  postfix: string;             // e.g. "EZ", "km", "PS (110 kW)"
}

/** Advertiser badge shown in search results. */
export interface ApiAdvertiserInfo {
  label: string;               // e.g. "Gewährleistung"
  iconSVG: string;
  iconPNG: string;
  iconType: string;            // e.g. "CHECK"
}

// ─── Search Response (Marktplatz, Vehicles, Immobilien) ─────────────────

/**
 * Response from `/webapi/ad-search/search/atz/{vertical}/{searchId}/atverz`
 *
 * Top-level can be either `advertSummary` (flat array) or
 * `advertSummaryList.advertSummary` (nested). Both shapes are observed.
 * `rowsFound` is sometimes absent for keyword searches.
 *
 * Used by: search-marktplatz.ts, search-vehicles.ts, search-immo.ts,
 *          similar.ts, similar-item.ts, similar-product.ts
 */
export interface ApiSearchResponse {
  advertSummary?: ApiAdvertSummary[];
  advertSummaryList?: {
    advertSummary?: ApiAdvertSummary[];
  };
  rowsFound?: number;
  rowsReturned?: number;
}

/**
 * A single search result item.
 *
 * This is the universal item shape across ALL search endpoints
 * (Marktplatz, Vehicles, Immobilien, Recommendations).
 * The `attributes` field contains all vertical-specific data.
 */
export interface ApiAdvertSummary {
  id: string;
  verticalId: number;          // 1=Jobs, 2=Immobilien, 3=Fahrzeuge, 5=Marktplatz
  adTypeId: number;            // e.g. 67 (Marktplatz), 20 (Auto), 21 (Moto)
  productId: number;
  advertStatus: ApiAdvertStatus;
  description: string;         // Short description / heading
  attributes: ApiAttributeList;
  advertImageList: ApiAdvertImageList;
  selfLink: string;
  contextLinkList: ApiContextLinkList;
  advertiserInfo: ApiAdvertiserInfo | null;
  upsellingOrganisationLogo: unknown | null;
  teaserAttributes: ApiTeaserAttribute[];
  children: unknown | null;
  dmpParameters: Record<string, unknown> | null;
}

// ─── Well-known Attribute Names ─────────────────────────────────────────

/**
 * Common attribute names found in ApiAdvertSummary.attributes.
 * Not exhaustive — each vertical has additional specific attributes.
 *
 * @see api.md for vertical-specific attributes (CAR_MODEL/*, MC_MODEL/*, etc.)
 */
export const ApiAttr = {
  // Price
  PRICE: 'PRICE',
  PRICE_AMOUNT: 'PRICE/AMOUNT',
  PRICE_FOR_DISPLAY: 'PRICE_FOR_DISPLAY',

  // Location
  LOCATION: 'LOCATION',
  POSTCODE: 'POSTCODE',
  STATE: 'STATE',
  DISTRICT: 'DISTRICT',
  COUNTRY: 'COUNTRY',
  COORDINATES: 'COORDINATES',

  // Ad metadata
  HEADING: 'HEADING',
  BODY_DYN: 'BODY_DYN',
  ADTYPE_ID: 'ADTYPE_ID',
  PRODUCT_ID: 'PRODUCT_ID',
  ADID: 'ADID',
  AD_UUID: 'AD_UUID',
  SEO_URL: 'SEO_URL',
  MMO: 'MMO',
  ALL_IMAGE_URLS: 'ALL_IMAGE_URLS',

  // Seller
  ISPRIVATE: 'ISPRIVATE',
  ORGID: 'ORGID',
  ORGNAME: 'ORGNAME',
  ORG_UUID: 'ORG_UUID',

  // Dates
  PUBLISHED: 'PUBLISHED',
  PUBLISHED_STRING: 'PUBLISHED_String',
  CHANGED: 'CHANGED',
  CHANGED_STRING: 'CHANGED_String',
  ENDDATE: 'ENDDATE',
  ENDDATE_STRING: 'ENDDATE_String',
  LAST_UPDATED: 'LAST_UPDATED',

  // Categories
  CATEGORYTREEIDS: 'categorytreeids',
  CATEGORYTREEATTRIBUTEIDS: 'categorytreeattributeids',

  // Vehicle-specific (searchId=2)
  CAR_MAKE: 'CAR_MODEL/MAKE',
  CAR_MODEL: 'CAR_MODEL/MODEL',
  CAR_MODEL_SPEC: 'CAR_MODEL/MODEL_SPECIFICATION',
  YEAR_MODEL: 'YEAR_MODEL',
  MILEAGE: 'MILEAGE',
  ENGINE_EFFECT: 'ENGINE/EFFECT',
  ENGINE_FUEL: 'ENGINE/FUEL',
  ENGINE_FUEL_RESOLVED: 'ENGINE/FUEL_RESOLVED',
  TRANSMISSION: 'TRANSMISSION',
  TRANSMISSION_RESOLVED: 'TRANSMISSION_RESOLVED',
  CAR_TYPE: 'CAR_TYPE',
  CONDITION: 'CONDITION',
  CONDITION_RESOLVED: 'CONDITION_RESOLVED',
  CONDITION_REPORT: 'CONDITION_REPORT',
  EQUIPMENT: 'EQUIPMENT',
  EQUIPMENT_RESOLVED: 'EQUIPMENT_RESOLVED',
  EXTERIORCOLOURMAIN: 'EXTERIORCOLOURMAIN',
  NOOFSEATS: 'NOOFSEATS',
  NO_OF_OWNERS: 'NO_OF_OWNERS',
  WARRANTY: 'WARRANTY',
  WARRANTY_RESOLVED: 'WARRANTY_RESOLVED',
  DEFECTS_LIABILITY: 'DEFECTS_LIABILITY',

  // Motorrad-specific (searchId=4)
  MC_MAKE: 'MC_MODEL/MAKE',
  MC_MODEL: 'MC_MODEL/MODEL',
  MC_MODEL_SPEC: 'MC_MODEL/MODEL_SPECIFICATION',
  MC_CATEGORY: 'MC_CATEGORY',
  MC_CATEGORY_RESOLVED: 'MC_CATEGORY_RESOLVED',
  ENGINEVOLUME: 'ENGINEVOLUME',

  // Nutzfahrzeug-specific (searchId=50)
  VAN_MAKE: 'VAN_MODEL/MAKE',
  VAN_MODEL: 'VAN_MODEL/MODEL',
  VAN_SEGMENT: 'VAN_SEGMENT',

  // Wohnwagen-specific (searchId=52)
  CARAVAN_MAKE: 'CARAVAN_MODEL/MAKE',
  CARAVAN_MODEL: 'CARAVAN_MODEL/MODEL',
  CARAVAN_SEGMENT: 'CARAVAN_SEGMENT',
  CARAVAN_SEGMENT_RESOLVED: 'CARAVAN_SEGMENT_RESOLVED',
  NO_OF_BERTHS: 'NO_OF_BERTHS',

  // Immobilien-specific
  ESTATE_SIZE_LIVING_AREA: 'ESTATE_SIZE/LIVING_AREA',
  NUMBER_OF_ROOMS: 'NUMBER_OF_ROOMS',
  RENT_PER_MONTH: 'RENT/PER_MONTH_LETTINGS',
  PROPERTY_TYPE: 'PROPERTY_TYPE',
  FLOOR: 'FLOOR',
} as const;

// ─── User Folders (Merkliste) ───────────────────────────────────────────

/**
 * Response from `GET /webapi/iad/userfolders/{userId}`
 */
export interface ApiUserFoldersResponse {
  contextLinkList: ApiContextLinkList;
  taggingData: ApiTaggingData;
  advertFolders: ApiAdvertFolder[];
}

/** A single merkliste folder. */
export interface ApiAdvertFolder {
  id: number;
  defaultFolder: boolean;
  name: string;
  description: string;
  advertCount: number;
  advertFolderItemList: {
    advertFolderItems: unknown[];  // empty in list response
  };
  contextLinkList: ApiContextLinkList;
  taggingData: ApiTaggingData;
  deletedAdvertCount: number;
}

/**
 * Response from `POST /webapi/iad/userfolders/save/{userId}/{folderId}/{adId}`
 */
export interface ApiSaveAdResponse {
  savedInFolder: boolean;
  contextLinkList: ApiContextLinkList;
}

/**
 * Response from `DELETE /webapi/iad/userfolders/savedAd/{userId}/{adId}`
 * Returns 204 No Content (empty body).
 */
export type ApiRemoveAdResponse = void;

/**
 * Response from `POST /webapi/iad/userfolders/{userId}` (create folder)
 */
export interface ApiCreateFolderResponse {
  id: number;
  name: string;
  description: string;
  defaultFolder: boolean;
  advertCount: number;
  contextLinkList: ApiContextLinkList;
}

// ─── Analytics / Tagging (embedded in responses) ────────────────────────

/** Tagging data embedded in folder responses (analytics/tracking). */
export interface ApiTaggingData {
  taggingNames: {
    nameValuePair: Array<{ name: string; value: string }>;
  };
  tmsDataValues: {
    tmsData: Record<string, unknown>;
  };
  pulseData: {
    pulseEvents: unknown[];
  };
  neustarTaggingData: unknown | null;
  qualtricsParameter: unknown | null;
}

// ─── Vehicle DMP Parameters (analytics, useful as data source) ──────────

/** Structured analytics data embedded in vehicle search results. */
export interface ApiVehicleDmpParameters {
  motorcondition?: string[];
  heading?: string;
  city?: string[];
  registrationfirstyear?: number;
  fuel?: string[];
  noofseats?: number;
  postcode?: number[];
  postcode_str?: string[];
  make_model?: string[];
  transmission?: string[];
  price?: number;
  conditionreport?: boolean;
  effect?: number;
  warranty?: boolean;
  model?: string[];
  state?: string[];
  make?: string[];
  mileage?: number;
}

// ─── Attribute Helper ───────────────────────────────────────────────────

/**
 * Parse an ApiAttributeList into a flat key→value Record.
 * Takes the first value from each attribute's values array.
 */
export function parseAttributes(attrs: ApiAttributeList | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!attrs?.attribute) return result;
  for (const a of attrs.attribute) {
    if (a.name && a.values?.[0] !== undefined) {
      result[a.name] = a.values[0];
    }
  }
  return result;
}

/**
 * Get a single attribute value from an ApiAttributeList.
 */
export function getAttr(attrs: ApiAttributeList | undefined, name: string): string | undefined {
  return attrs?.attribute?.find(a => a.name === name)?.values?.[0];
}

/**
 * Get all values for an attribute (some attributes have multiple values).
 */
export function getAttrValues(attrs: ApiAttributeList | undefined, name: string): string[] {
  return attrs?.attribute?.find(a => a.name === name)?.values ?? [];
}
