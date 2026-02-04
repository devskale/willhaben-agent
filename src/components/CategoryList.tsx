import React from "react";
import { Box, Text } from "ink";
import { CategorySuggestion } from "../types.js";

interface CategoryListProps {
  categories: CategorySuggestion[];
  categoryIndex: number;
  selectedCategoryName: string | null;
  setCategoryIndex: (index: number) => void;
  setFocusedSection: (section: "search" | "categories" | "products") => void;
  focused: boolean;
}

export function CategoryList({
  categories,
  categoryIndex,
  selectedCategoryName,
  setCategoryIndex,
  setFocusedSection,
  focused,
}: CategoryListProps) {
  if (categories.length === 0) return null;

  const windowSize = 10;
  const start = Math.floor(categoryIndex / windowSize) * windowSize;
  const end = Math.min(start + windowSize, categories.length);
  const visibleCategories = categories.slice(start, end);

  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      borderStyle="round"
      borderColor={focused ? "green" : "cyan"}
      paddingX={1}
    >
      <Text bold color={focused ? "green" : "cyan"}>
        Categories (Select to filter):
      </Text>
      {visibleCategories.map((c, i) => {
        const actualIndex = start + i;
        const isSelected = actualIndex === categoryIndex;
        return (
          <Text key={c.id} color={isSelected ? "green" : "white"} bold={isSelected}>
            {isSelected ? "> " : "  "}
            {c.name} {c.id !== "all" ? `(${c.count})` : ""}
          </Text>
        );
      })}
      {categories.length > end && <Text color="dim">...more</Text>}
    </Box>
  );
}
