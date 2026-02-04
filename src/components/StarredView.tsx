import React from "react";
import { Box, Text } from "ink";
import { StarredItem } from "../agents/db.js";
import { createImageFrame } from "./ascii-art.js";

interface StarredViewProps {
  items: StarredItem[];
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  onSelect: (item: StarredItem) => void;
  onUnstar: (item: StarredItem) => void;
}

export function StarredView({
  items,
  selectedIndex,
  setSelectedIndex,
  onSelect,
  onUnstar,
}: StarredViewProps) {
  if (items.length === 0) {
    return (
      <Box marginTop={1}>
        <Text color="dim">No starred items yet.</Text>
      </Box>
    );
  }

  const windowSize = 10;
  const start = Math.floor(selectedIndex / windowSize) * windowSize;
  const end = Math.min(start + windowSize, items.length);
  const visibleItems = items.slice(start, end);

  return (
    <Box
      flexDirection="column"
      marginTop={1}
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
    >
      <Text bold color="yellow">
        Starred Items ({items.length}):
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {visibleItems.map((item, i) => {
          const actualIndex = start + i;
          const isSelected = actualIndex === selectedIndex;
          const borderColor = isSelected ? "green" : "gray";
          const hasImage = !!item.imageUrl;

          return (
            <Box
              key={item.id}
              flexDirection="column"
              borderStyle={isSelected ? "double" : "single"}
              borderColor={borderColor}
              paddingX={1}
            >
              {/* ASCII Image Preview */}
              <Box marginBottom={0}>
                <Text color="cyan">
                  {hasImage ? createImageFrame(true) : "  "}
                </Text>
              </Box>

              {/* Product Info */}
              <Box flexDirection="row" justifyContent="space-between">
                <Box width="60%">
                  <Text color={isSelected ? "green" : "white"} bold={isSelected}>
                    ★ {item.title}
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
              </Box>
            </Box>
          );
        })}
        {items.length > end && (
          <Text color="dim" italic>
            ...and {items.length - end} more
          </Text>
        )}
        <Box marginTop={1}>
          <Text color="dim">Space: Unstar | Enter: Details | Esc: Back</Text>
        </Box>
      </Box>
    </Box>
  );
}
