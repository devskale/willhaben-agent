import React from "react";
import { Box, Text } from "ink";
import { SearchHistoryItem } from "../agents/db.js";

interface HistoryViewProps {
  items: SearchHistoryItem[];
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  onSelect: (item: SearchHistoryItem) => void;
}

export function HistoryView({
  items,
  selectedIndex,
  setSelectedIndex,
  onSelect,
}: HistoryViewProps) {
  if (items.length === 0) {
    return (
      <Box marginTop={1}>
        <Text color="dim">No search history.</Text>
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
      borderColor="blue"
      paddingX={1}
    >
      <Text bold color="blue">
        Search History (Enter to restore):
      </Text>
      {visibleItems.map((item, i) => {
        const actualIndex = start + i;
        const isSelected = actualIndex === selectedIndex;
        return (
          <Text
            key={item.id}
            color={isSelected ? "green" : "white"}
            bold={isSelected}
          >
            {isSelected ? "> " : "  "}
            {item.query}
            {item.categoryName ? ` [${item.categoryName}]` : ""}
            <Text color="dim">
              {" "} ({new Date(item.createdAt).toLocaleString()})
            </Text>
          </Text>
        );
      })}
      {items.length > end && <Text color="dim">...more</Text>}
    </Box>
  );
}
