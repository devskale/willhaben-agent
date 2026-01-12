import { checkAuth } from "./auth.js";
import { load } from "cheerio";
import {
  Listing,
  ListingDetail,
  SearchResult,
  Seller,
  CategorySuggestion,
} from "../types.js";

const BASE_URL = "https://www.willhaben.at";

const getHeaders = (cookies: string) => ({
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Cookie: cookies,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "de-AT,de;q=0.9,en;q=0.8",
});

const parseAttributes = (item: any): Record<string, any> => {
  const attrsData = item.attributes || {};
  let attrsList = [];

  if (Array.isArray(attrsData)) {
    attrsList = attrsData;
  } else if (attrsData.attribute) {
    attrsList = attrsData.attribute;
  }

  const attributes: Record<string, any> = {};
  for (const attr of attrsList) {
    if (attr.name) {
      attributes[attr.name] = attr.values || [];
    }
  }
  return attributes;
};

const parseListing = (item: any): Listing => {
  const attributes = parseAttributes(item);

  // Price extraction
  let price: number | null = null;
  let priceText = "";

  if (attributes["PRICE_FOR_DISPLAY"] && attributes["PRICE_FOR_DISPLAY"][0]) {
    priceText = attributes["PRICE_FOR_DISPLAY"][0];
  }

  if (attributes["PRICE/AMOUNT"] && attributes["PRICE/AMOUNT"][0]) {
    try {
      price = parseFloat(attributes["PRICE/AMOUNT"][0]);
      if (!priceText) {
        priceText = `€ ${price.toLocaleString("de-AT", { minimumFractionDigits: 2 })}`;
      }
    } catch (e) {}
  } else if (attributes["PRICE"] && attributes["PRICE"][0]) {
    try {
      price = parseFloat(attributes["PRICE"][0]);
      if (!priceText) {
        priceText = `€ ${price.toLocaleString("de-AT", { minimumFractionDigits: 2 })}`;
      }
    } catch (e) {}
  }

  // Location
  const locationParts = [];
  if (attributes["POSTCODE"]) locationParts.push(...attributes["POSTCODE"]);
  if (attributes["LOCATION"]) locationParts.push(...attributes["LOCATION"]);
  const location = locationParts.join(", ");

  const title =
    typeof item.description === "string"
      ? item.description
      : item.description?.header || "No Title";

  const description = item.body || "";

  return {
    id: item.id,
    title,
    price,
    priceText,
    location,
    description,
    url: `${BASE_URL}/iad/object?adId=${item.id}`,
    imageUrl:
      item.mainImageUrl || item.advertImageList?.advertImage?.[0]?.mainImageUrl,
    sellerId: attributes["SELLER_ID"]?.[0],
    sellerName: attributes["SELLER_NAME"]?.[0] || "",
    publishedAt: undefined, // Date parsing omitted for brevity
    condition: attributes["CONDITION"]?.[0] || "",
    paylivery: !!attributes["PAYLIVERY"],
  };
};

export const searchItems = async (
  keyword: string,
  categoryId?: string
): Promise<SearchResult> => {
  const { cookies } = await checkAuth();
  const headers = getHeaders(cookies);

  let url = `${BASE_URL}/iad/kaufen-und-verkaufen/marktplatz?keyword=${encodeURIComponent(keyword)}`;
  if (categoryId) {
    url += `&ATTRIBUTE_TREE=${categoryId}`;
  }

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Search failed with status: ${response.status}`);
    }

    const html = await response.text();
    const $ = load(html);
    const nextData = $("#__NEXT_DATA__").html();

    if (!nextData) {
      throw new Error("Could not find data on page (missing __NEXT_DATA__)");
    }

    const data = JSON.parse(nextData);
    const searchResult = data.props?.pageProps?.searchResult;
    const categorySuggestionsData =
      data.props?.pageProps?.categorySuggestions || [];

    if (!searchResult) {
      return { items: [], totalFound: 0, categories: [] };
    }

    const ads = searchResult.advertSummaryList?.advertSummary || [];
    const totalFound = searchResult.rowsFound || ads.length;
    const items = ads.map(parseListing);

    // Extract categories
    let categories: CategorySuggestion[] = [];

    if (searchResult.navigatorGroups) {
      const isCategoryGroup = (g: any) =>
        g.id === "attribute_tree" ||
        g.name === "ATTRIBUTE_TREE" ||
        g.id === "category" ||
        g.label === "Kategorie";

      let categoryGroup = searchResult.navigatorGroups.find(isCategoryGroup);

      // If not found, try nested navigatorList
      if (!categoryGroup) {
        for (const group of searchResult.navigatorGroups) {
          if (group.navigatorList) {
            const found = group.navigatorList.find(isCategoryGroup);
            if (found) {
              categoryGroup = found;
              break;
            }
          }
        }
      }

      if (categoryGroup) {
        // console.log("Found category group:", categoryGroup.id);
        // Handle both flat values and groupedPossibleValues
        if (categoryGroup.values) {
          categories = categoryGroup.values.map((val: any) => ({
            id: val.value,
            name: val.label,
            count: val.hits || 0,
          }));
        } else if (categoryGroup.groupedPossibleValues?.[0]?.possibleValues) {
          // console.log("Found groupedPossibleValues:", categoryGroup.groupedPossibleValues[0].possibleValues.length);
          categories = categoryGroup.groupedPossibleValues[0].possibleValues
            .map((val: any) => ({
              id: val.urlParamRepresentationForValue?.find(
                (p: any) => p.urlParameterName === "ATTRIBUTE_TREE"
              )?.value,
              name: val.label,
              count: val.hits || 0,
            }))
            .filter((c: any) => c.id); // Ensure we have an ID
        }
      }
    }

    if (categories.length === 0 && categorySuggestionsData.length > 0) {
      categories = categorySuggestionsData.map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        count: cat.count || 0,
      }));
    }

    categories.sort((a, b) => b.count - a.count);

    return { items, totalFound, categories };
  } catch (error) {
    console.error("Search error:", error);
    throw error;
  }
};

export const getListingDetails = async (
  adId: string
): Promise<ListingDetail> => {
  const { cookies } = await checkAuth();
  const headers = getHeaders(cookies);
  const url = `${BASE_URL}/iad/object?adId=${adId}`;

  const response = await fetch(url, { headers });
  if (!response.ok)
    throw new Error(`Failed to fetch listing: ${response.status}`);

  const html = await response.text();
  const $ = load(html);
  const nextData = $("#__NEXT_DATA__").html();
  if (!nextData) throw new Error("Missing __NEXT_DATA__");

  const data = JSON.parse(nextData);
  const adData = data.props?.pageProps?.advertDetails;

  if (!adData) throw new Error("Advert details not found");

  const basicListing = parseListing(adData);
  const attributes = parseAttributes(adData);

  const images = (adData.images || [])
    .map((img: any) => img.mainImageUrl)
    .filter(Boolean);

  return {
    ...basicListing,
    fullDescription: adData.body || "",
    images,
    attributes,
    phone: attributes["PHONE"]?.[0],
    views: undefined, // Not easily available in initial data
  };
};

export const getSeller = async (userId: string): Promise<Seller> => {
  const { cookies } = await checkAuth();
  const headers = getHeaders(cookies);
  const url = `https://publicapi.willhaben.at/userprofile/trust-signals/${userId}`;

  const response = await fetch(url, { headers });
  if (!response.ok)
    throw new Error(`Failed to fetch seller: ${response.status}`);

  const data = await response.json();

  return {
    id: userId,
    name: data.userName || "",
    rating: data.rating?.averageRating,
    ratingCount: data.rating?.ratingCount || 0,
    responseTime: data.responseTime?.label || "",
    verified: data.verificationStatus?.verified || false,
    professional: data.userType === "PROFESSIONAL",
    location: data.location || "",
  };
};
