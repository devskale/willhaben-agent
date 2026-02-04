import React from "react";
import { Box, Text } from "ink";
import { Listing, SearchResult } from "../types.js";
import { createImagePlaceholder } from "./ascii-art.js";

interface ProductListProps {
  searchResult: SearchResult | null;
  selectedCategoryName: string | null;
  page: number;
  productIndex: number;
  setProductIndex: (index: number) => void;
  onProductSelect: (item: Listing) => void;
  setFocusedSection: (section: "search" | "categories" | "products") => void;
  onPageChange: (direction: "next" | "prev") => void;
  focused: boolean;
  starredIds: Set<string>;
}

export function ProductList({
  searchResult,
  selectedCategoryName,
  page,
  productIndex,
  setProductIndex,
  onProductSelect,
  setFocusedSection,
  onPageChange,
  focused,
  starredIds,
}: ProductListProps) {
  if (!searchResult?.items.length) return null;

  const items = searchResult.items;
  const windowSize = 10;
  const start = Math.floor(productIndex / windowSize) * windowSize;
  const end = Math.min(start + windowSize, items.length);
  const visibleItems = items.slice(start, end);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold>
        Found {searchResult.totalFound} items
        {selectedCategoryName ? ` in ${selectedCategoryName}` : ""}
        {` (Page ${page})`} :
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {visibleItems.map((item, i) => {
          const actualIndex = start + i;
          const isSelected = actualIndex === productIndex;
          const isStarredItem = starredIds.has(item.id);
          const borderColor =
            isSelected && focused ? "green" : "gray";
          const hasImage = !!item.imageUrl;

          return (
            <Box
              key={item.id}
              flexDirection="column"
              borderStyle={isSelected ? "double" : "single"}
              borderColor={borderColor}
              paddingX={1}
            >
              {/* ASCII Image Preview Indicator */}
              <Box marginBottom={0}>
                <Text color="cyan">
                  {hasImage ? createImagePlaceholder(30, 3) : "  "}
                </Text>
              </Box>

              {/* Product Info */}
              <Box flexDirection="row" justifyContent="space-between">
                <Box width="60%">
                  <Text color={isSelected ? "green" : "white"} bold={isSelected}>
                    {isStarredItem ? "★ " : ""}
                    {item.title.substring(0, 40)}
                    {item.title.length > 40 ? "..." : ""}
                  </Text>
                </Box>
                <Box width="20%">
                  <Text color="green" bold>
                    {item.priceText}
                  </Text>
                </Box>
                <Box width="20%">
                  <Text color="dim">{item.id}</Text>
                </Box>
              </Box>

              {/* Metadata Row */}
              <Box flexDirection="row" marginTop={0}>
                <Box width="40%">
                  <Text color="yellow">{item.location}</Text>
                </Box>
                <Box width="30%">
                  <Text color="cyan">{item.sellerName}</Text>
                </Box>
                {item.paylivery && (
                  <Box>
                    <Text color="magenta"> ✓ PayLivery</Text>
                  </Box>
                )}
                {hasImage && (
                  <Box marginLeft={1}>
                    <Text color="cyan">📷</Text>
                  </Box>
                )}
              </Box>
            </Box>
          );
        })}
        {items.length > end && (
          <Text color="dim" italic>
            ...and {items.length - end} more on this page
          </Text>
        )}
        <Box marginTop={1}>
          <Text color="dim">
            Space: Star/Unstar | n: Next Page | p: Prev Page | Right: Open |
            Left: Categories
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
