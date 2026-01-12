import React, { useState, useEffect } from "react";
import { Text, Box, useInput } from "ink";
import TextInput from "ink-text-input";
import SelectInput from "ink-select-input";
import { checkAuth, AuthState } from "./agents/auth.js";
import { searchItems } from "./agents/search.js";
import { SearchResult } from "./types.js";

export default function App() {
  const [auth, setAuth] = useState<AuthState>({
    isAuthenticated: false,
    cookies: "",
  });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<
    string | null
  >(null);
  const [activeComponent, setActiveComponent] = useState<
    "search" | "categories"
  >("search");

  useEffect(() => {
    const initAuth = async () => {
      const result = await checkAuth();
      setAuth(result);
      setLoading(false);
    };
    initAuth();
  }, []);

  const handleSearch = async (value: string) => {
    if (!value.trim()) return;
    setSearching(true);
    setError(null);
    setSearchResult(null);
    setSelectedCategoryName(null);
    setActiveComponent("search");
    try {
      const result = await searchItems(value);
      setSearchResult(result);
      // If we have categories, focus the category selection
      if (result.categories.length > 0) {
        setActiveComponent("categories");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown search error");
    } finally {
      setSearching(false);
    }
  };

  const handleCategorySelect = async (item: any) => {
    const categoryId = item.value === "all" ? undefined : item.value;

    if (item.value !== "all" && searchResult) {
      const category = searchResult.categories.find((c) => c.id === categoryId);
      setSelectedCategoryName(category ? category.name : null);
    } else {
      setSelectedCategoryName(null);
    }

    setSearching(true);
    try {
      // Keep the query but filter by category
      const result = await searchItems(query, categoryId);
      setSearchResult(result);
      // Stay on categories or move back to search?
      // For now stay on categories to allow changing filter,
      // but maybe we should focus something else.
      // Let's keep focus on categories for refinement.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown search error");
    } finally {
      setSearching(false);
    }
  };

  useInput((input, key) => {
    if (key.escape) {
      // Clear results on escape and focus search
      setSearchResult(null);
      setSelectedCategoryName(null);
      setQuery("");
      setActiveComponent("search");
    }
    if (key.return && activeComponent === "categories" && !searchResult) {
      // Fallback to search if something weird happens
      setActiveComponent("search");
    }
  });

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
          onSubmit={handleSearch}
          placeholder="Type keyword and press Enter..."
          focus={activeComponent === "search"}
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
          {searchResult.categories.length > 0 && (
            <Box
              flexDirection="column"
              marginBottom={1}
              borderStyle="round"
              borderColor="cyan"
              paddingX={1}>
              <Text bold color="cyan">
                Categories (Select to filter):
              </Text>
              <SelectInput
                items={[
                  { label: "All Categories", value: "all" },
                  ...searchResult.categories.map((c) => ({
                    label: `${c.name} (${c.count})`,
                    value: c.id,
                  })),
                ]}
                onSelect={handleCategorySelect}
                isFocused={activeComponent === "categories"}
                limit={10}
              />
            </Box>
          )}

          <Text bold>
            Found {searchResult.totalFound} items
            {selectedCategoryName ? ` in ${selectedCategoryName}` : ""} :
          </Text>
          <Box flexDirection="column" marginTop={1}>
            {searchResult.items.slice(0, 10).map((item) => (
              <Box
                key={item.id}
                flexDirection="column"
                borderStyle="single"
                borderColor="gray"
                paddingX={1}>
                <Box flexDirection="row" justifyContent="space-between">
                  <Box width="60%">
                    <Text color="white" bold>
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
            ))}
            {searchResult.items.length > 10 && (
              <Text color="dim" italic>
                ...and {searchResult.items.length - 10} more (showing top 10)
              </Text>
            )}
          </Box>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color="dim">Press Esc to clear results, Ctrl+C to exit</Text>
      </Box>
    </Box>
  );
}
