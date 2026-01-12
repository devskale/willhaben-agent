import React, { useState, useEffect } from "react";
import { Text, Box, useInput } from "ink";
import TextInput from "ink-text-input";
import { checkAuth, AuthState } from "./agents/auth.js";
import { searchItems } from "./agents/search.js";
import { SearchResult, CategorySuggestion, Listing } from "./types.js";

type FocusedSection = "search" | "categories" | "products";

export default function App() {
  // Auth State
  const [auth, setAuth] = useState<AuthState>({
    isAuthenticated: false,
    cookies: "",
  });
  const [loading, setLoading] = useState(true);

  // Search State
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [selectedCategoryName, setSelectedCategoryName] = useState<
    string | null
  >(null);

  // Navigation State
  const [focusedSection, setFocusedSection] =
    useState<FocusedSection>("search");
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [productIndex, setProductIndex] = useState(0);

  // Initial Auth Check
  useEffect(() => {
    const initAuth = async () => {
      const result = await checkAuth();
      setAuth(result);
      setLoading(false);
    };
    initAuth();
  }, []);

  // Helper to perform search
  const performSearch = async (q: string, catId?: string, p: number = 1) => {
    if (!q.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const result = await searchItems(q, catId, p);
      setSearchResult(result);
      // Reset indices if new search (page 1)
      if (p === 1) {
        setProductIndex(0);
        setCategoryIndex(0); // Should we reset category index? Maybe not if just filtering.
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown search error");
    } finally {
      setSearching(false);
    }
  };

  // Input Handling
  useInput((input, key) => {
    if (key.escape) {
      setSearchResult(null);
      setQuery("");
      setCategoryId(undefined);
      setSelectedCategoryName(null);
      setPage(1);
      setFocusedSection("search");
      return;
    }

    if (focusedSection === "search") {
      // TextInput handles text input.
      // Down arrow to move to categories if available, else products
      if (key.downArrow) {
        if (searchResult?.categories && searchResult.categories.length > 0) {
          setFocusedSection("categories");
          setCategoryIndex(0);
        } else if (searchResult?.items && searchResult.items.length > 0) {
          setFocusedSection("products");
          setProductIndex(0);
        }
      }
    } else if (focusedSection === "categories") {
      const categories = [
        { id: "all", name: "All Categories", count: 0 },
        ...(searchResult?.categories || []),
      ];

      if (key.upArrow) {
        setCategoryIndex(Math.max(0, categoryIndex - 1));
      }
      if (key.downArrow) {
        setCategoryIndex(Math.min(categories.length - 1, categoryIndex + 1));
      }
      if (key.leftArrow) {
        setFocusedSection("search");
      }
      if (key.rightArrow || key.return) {
        const selected = categories[categoryIndex];
        const newCatId = selected.id === "all" ? undefined : selected.id;

        setCategoryId(newCatId);
        setSelectedCategoryName(selected.id === "all" ? null : selected.name);
        setPage(1);

        // Trigger search
        performSearch(query, newCatId, 1).then(() => {
          // After search, focus products if any ONLY if Enter was pressed
          if (key.return) {
            setFocusedSection("products");
            setProductIndex(0);
          }
        });
      }
    } else if (focusedSection === "products") {
      const items = searchResult?.items || [];

      if (key.upArrow) {
        setProductIndex(Math.max(0, productIndex - 1));
      }
      if (key.downArrow) {
        setProductIndex(Math.min(items.length - 1, productIndex + 1));
      }
      if (key.leftArrow) {
        if (searchResult?.categories && searchResult.categories.length > 0) {
          setFocusedSection("categories");
        } else {
          setFocusedSection("search");
        }
      }
      if (key.rightArrow || key.return) {
        if (items[productIndex]) {
          // Open URL (mock for now)
          // console.log("Opening", items[productIndex].url);
          // In a real TUI, maybe we can't open easily.
          // We'll show a "Opening..." message or similar.
        }
      }

      // Pagination
      if (input === " ") {
        if (key.shift) {
          if (page > 1) {
            const newPage = page - 1;
            setPage(newPage);
            performSearch(query, categoryId, newPage);
          }
        } else {
          const newPage = page + 1;
          setPage(newPage);
          performSearch(query, categoryId, newPage);
        }
      }
    }
  });

  const handleSearchSubmit = (value: string) => {
    setQuery(value);
    setPage(1);
    setCategoryId(undefined);
    setSelectedCategoryName(null);
    performSearch(value, undefined, 1).then(() => {
      // If categories exist, user can focus them.
      // But let's keep focus on search or move to categories?
      // User said: "when a category is selected jump to the product listing"
      // But for initial search?
      // Let's stay on search so user can refine, or maybe move to categories.
      // Current behavior: focus categories if available.
      // Let's stick to that.
      // Actually, let's look at the result.
    });
  };

  // Render Helpers
  const renderCategories = () => {
    if (!searchResult?.categories.length) return null;

    const categories = [
      { id: "all", name: "All Categories", count: 0 },
      ...searchResult.categories,
    ];

    // Simple windowing
    const windowSize = 10;
    const start = Math.floor(categoryIndex / windowSize) * windowSize;
    const end = Math.min(start + windowSize, categories.length);
    const visibleCategories = categories.slice(start, end);

    return (
      <Box
        flexDirection="column"
        marginBottom={1}
        borderStyle="round"
        borderColor={focusedSection === "categories" ? "green" : "cyan"}
        paddingX={1}>
        <Text bold color={focusedSection === "categories" ? "green" : "cyan"}>
          Categories (Select to filter):
        </Text>
        {visibleCategories.map((c, i) => {
          const actualIndex = start + i;
          const isSelected = actualIndex === categoryIndex;
          return (
            <Text
              key={c.id}
              color={isSelected ? "green" : "white"}
              bold={isSelected}>
              {isSelected ? "> " : "  "}
              {c.name} {c.id !== "all" ? `(${c.count})` : ""}
            </Text>
          );
        })}
        {categories.length > end && <Text color="dim">...more</Text>}
      </Box>
    );
  };

  const renderProducts = () => {
    if (!searchResult?.items.length) return null;

    const items = searchResult.items;
    // Windowing for products is not needed if we paginate?
    // Wait, searchResult.items is just one page (usually 25 items).
    // We can display all of them, or window them.
    // 25 items might be too long for terminal.
    // Let's window them to 10.

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
            const borderColor =
              isSelected && focusedSection === "products" ? "green" : "gray";

            return (
              <Box
                key={item.id}
                flexDirection="column"
                borderStyle={isSelected ? "double" : "single"}
                borderColor={borderColor}
                paddingX={1}>
                <Box flexDirection="row" justifyContent="space-between">
                  <Box width="60%">
                    <Text
                      color={isSelected ? "green" : "white"}
                      bold={isSelected}>
                      {item.title}
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
              ...and {items.length - end} more on this page
            </Text>
          )}
          <Box marginTop={1}>
            <Text color="dim">
              Space: Next Page | Shift+Space: Prev Page | Right: Open | Left:
              Categories
            </Text>
          </Box>
        </Box>
      </Box>
    );
  };

  if (loading) {
    return <Text color="yellow">Checking authentication...</Text>;
  }

  if (!auth.isAuthenticated) {
    return (
      <Box flexDirection="column">
        <Text color="red">Authentication Failed: {auth.error}</Text>
        <Text>
          Please login to willhaben.at in your browser
          (Chrome/Edge/Firefox/Safari) and try again.
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="green" bold>
        Willhaben CLI
      </Text>
      <Text color="dim">Authenticated via sweet-cookie</Text>

      <Box marginTop={1}>
        <Text>Search: </Text>
        <TextInput
          value={query}
          onChange={setQuery}
          onSubmit={handleSearchSubmit}
          placeholder="Type keyword and press Enter..."
          focus={focusedSection === "search"}
        />
      </Box>

      {searching && (
        <Box marginTop={1}>
          <Text color="blue">Searching for "{query}"...</Text>
        </Box>
      )}

      {error && (
        <Box marginTop={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      {searchResult && (
        <Box flexDirection="column" marginTop={1}>
          {renderCategories()}
          {renderProducts()}
        </Box>
      )}
    </Box>
  );
}
