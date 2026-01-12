export interface Listing {
  id: string;
  title: string;
  price: number | null;
  priceText: string;
  location: string;
  description: string;
  url: string;
  imageUrl?: string;
  sellerId?: string;
  sellerName: string;
  publishedAt?: string;
  condition: string;
  paylivery: boolean;
}

export interface ListingDetail extends Listing {
  fullDescription: string;
  images: string[];
  attributes: Record<string, any>;
  phone?: string;
  views?: number;
}

export interface Seller {
  id: string;
  name: string;
  rating?: number;
  ratingCount: number;
  responseTime: string;
  memberSince?: string;
  verified: boolean;
  professional: boolean;
  location: string;
}

export interface CategorySuggestion {
  id: string;
  name: string;
  count: number;
}

export interface SearchResult {
  items: Listing[];
  totalFound: number;
  categories: CategorySuggestion[];
}

export type FocusedSection =
  | "search"
  | "categories"
  | "products"
  | "detail"
  | "command"
  | "history"
  | "starred"
  | "me";
