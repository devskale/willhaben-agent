import React, { useState, useEffect } from "react";
import { Text, Box, useInput, useApp } from "ink";
import TextInput from "ink-text-input";
import { checkAuth, AuthState } from "./agents/auth.js";
import { searchItems, getListingDetails } from "./agents/search.js";
import {
  executeCommand,
  getCommandNames,
  CommandContext,
} from "./agents/command.js";
import {
  toggleStar,
  getStarredItems,
  getSearchHistory,
  addSearchHistory,
  SearchHistoryItem,
  StarredItem,
} from "./agents/db.js";
import { UserProfile } from "./agents/user.js";
import {
  SearchResult,
  Listing,
  ListingDetail,
  FocusedSection,
} from "./types.js";
import { SearchBar } from "./components/index.js";

export default function App() {
  const { exit } = useApp();

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

  // Search History for autocomplete
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [historyFocused, setHistoryFocused] = useState(false);

  // Detail View State
  const [selectedListing, setSelectedListing] = useState<ListingDetail | null>(
    null
  );
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Starred Items State
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [starredItemsList, setStarredItemsList] = useState<StarredItem[]>([]);
  const [starredIndex, setStarredIndex] = useState(0);

  // Search History State
  const [historyItems, setHistoryItems] = useState<SearchHistoryItem[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Command Mode State
  const [commandInput, setCommandInput] = useState("");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Navigation State
  const [focusedSection, setFocusedSection] =
    useState<FocusedSection>("search");
  const [previousSection, setPreviousSection] =
    useState<FocusedSection>("products");
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

    // Load initial starred items
    const starred = getStarredItems();
    setStarredIds(new Set(starred.map((s) => s.id)));

    // Load search history for autocomplete
    const history = getSearchHistory();
    setSearchHistory(history);
  }, []);

  // Helper to perform search
  const performSearch = async (
    q: string,
    catId?: string,
    p: number = 1,
    catName?: string
  ) => {
    if (!q.trim()) return null;
    setSearching(true);
    setError(null);

    // Save to history (only on first page to avoid spamming history with pagination)
    if (p === 1) {
      try {
        addSearchHistory(q, catId, catName);
      } catch {
        // Silently ignore history save errors to avoid disrupting the UI
      }
    }

    try {
      const result = await searchItems(q, catId, p);
      setSearchResult(result);
      // Reset indices if new search (page 1)
      if (p === 1) {
        setProductIndex(0);
        setCategoryIndex(0); // Should we reset category index? Maybe not if just filtering.
      }
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown search error");
      return null;
    } finally {
      setSearching(false);
    }
  };

  // Input Handling
  useInput((input, key) => {
    // Global Escape Handler
    if (key.escape) {
      if (focusedSection === "command") {
        setFocusedSection("search"); // Or revert to previous? Search is safe.
        setCommandInput("");
        return;
      }

      // Close history suggestions if open
      if (historyFocused) {
        setHistoryFocused(false);
        return;
      }

      setSearchResult(null);
      setQuery("");
      setCategoryId(undefined);
      setSelectedCategoryName(null);
      setPage(1);
      setFocusedSection("search");
      return;
    }

    // Global Command Trigger (/)
    if (input === "/") {
      const isSearchEmpty = focusedSection === "search" && query === "";
      const isNotSearchOrCommand =
        focusedSection !== "search" && focusedSection !== "command";

      if (isSearchEmpty || isNotSearchOrCommand) {
        setFocusedSection("command");
        setCommandInput("/");
        return;
      }
    }

    // Command Autocomplete
    if (focusedSection === "command") {
      if (key.tab || key.rightArrow) {
        const match = getCommandNames().find((c) => c.startsWith(commandInput));
        if (match) {
          setCommandInput(match);
        }
      }
    }

    if (focusedSection === "search") {
      // Don't handle arrow keys when history is focused - SearchBar handles them
      if (historyFocused) return;

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
        const isReturn = key.return; // Capture key state synchronously

        setCategoryId(newCatId);
        setSelectedCategoryName(selected.id === "all" ? null : selected.name);
        setPage(1);

        // Trigger search
        performSearch(query, newCatId, 1).then((result) => {
          // After search, focus products if any ONLY if Enter was pressed
          if (isReturn) {
            setFocusedSection("products");
            setProductIndex(0);
          } else {
            // Right Arrow (Drill down)
            // If we drilled down to a leaf category (no sub-categories), switch to products
            if (
              result &&
              (!result.categories || result.categories.length === 0)
            ) {
              setFocusedSection("products");
              setProductIndex(0);
            }
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
          const item = items[productIndex];
          setPreviousSection("products");
          setFocusedSection("detail");
          setLoadingDetail(true);
          // Fetch full details
          getListingDetails(item.id)
            .then((detail) => {
              setSelectedListing(detail);
            })
            .catch((e) => {
              setError(
                e instanceof Error ? e.message : "Failed to load details"
              );
            })
            .finally(() => {
              setLoadingDetail(false);
            });
        }
      }

      // Pagination & Starring
      if (input === " ") {
        // Toggle Star
        if (items[productIndex]) {
          const item = items[productIndex];
          const isNowStarred = toggleStar(item);
          setStarredIds((prev) => {
            const next = new Set(prev);
            if (isNowStarred) {
              next.add(item.id);
            } else {
              next.delete(item.id);
            }
            return next;
          });
        }
      }

      if (input === "p") {
        if (page > 1) {
          const newPage = page - 1;
          setPage(newPage);
          performSearch(query, categoryId, newPage);
        }
      }
      if (input === "n") {
        const newPage = page + 1;
        setPage(newPage);
        performSearch(query, categoryId, newPage);
      }
    } else if (focusedSection === "detail") {
      if (key.leftArrow) {
        setFocusedSection(previousSection);
        setSelectedListing(null);
      }
    } else if (focusedSection === "history") {
      if (key.upArrow) {
        setHistoryIndex(Math.max(0, historyIndex - 1));
      }
      if (key.downArrow) {
        setHistoryIndex(Math.min(historyItems.length - 1, historyIndex + 1));
      }
      if (key.escape) {
        setFocusedSection("search");
      }
      if (key.return) {
        const selected = historyItems[historyIndex];
        if (selected) {
          setQuery(selected.query);
          setCategoryId(selected.categoryId);
          setSelectedCategoryName(selected.categoryName || null);
          setPage(1);
          setFocusedSection("products");
          performSearch(
            selected.query,
            selected.categoryId,
            1,
            selected.categoryName
          );
        }
      }
    } else if (focusedSection === "starred") {
      if (key.upArrow) {
        setStarredIndex(Math.max(0, starredIndex - 1));
      }
      if (key.downArrow) {
        setStarredIndex(
          Math.min(starredItemsList.length - 1, starredIndex + 1)
        );
      }
      if (key.escape) {
        setFocusedSection("search");
      }
      if (key.return || key.rightArrow) {
        if (starredItemsList[starredIndex]) {
          const item = starredItemsList[starredIndex];
          setPreviousSection("starred");
          setFocusedSection("detail");
          setLoadingDetail(true);
          getListingDetails(item.id)
            .then((detail) => {
              setSelectedListing(detail);
            })
            .catch((e) => {
              // Fallback to stored details if fetch fails?
              // For now, just show error
              setError(
                e instanceof Error ? e.message : "Failed to load details"
              );
            })
            .finally(() => {
              setLoadingDetail(false);
            });
        }
      }
      if (input === " ") {
        // Unstar
        if (starredItemsList[starredIndex]) {
          const item = starredItemsList[starredIndex];
          toggleStar(item); // We know it returns false (unstarred)
          setStarredIds((prev) => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
          // Remove from current list immediately
          const newList = starredItemsList.filter((i) => i.id !== item.id);
          setStarredItemsList(newList);
          if (starredIndex >= newList.length) {
            setStarredIndex(Math.max(0, newList.length - 1));
          }
        }
      }
    } else if (focusedSection === "me") {
      if (key.escape) {
        setFocusedSection("search");
      }
    }
  });

  const handleCommandSubmit = async (value: string) => {
    const cmd = value.trim();

    const context: CommandContext = {
      exit,
      setCommandInput,
      setFocusedSection,
      setHistoryItems,
      setHistoryIndex,
      setStarredItemsList,
      setStarredIndex,
      setUserProfile,
      setIsLoading: setLoadingProfile,
    };

    const executed = await executeCommand(cmd, context);

    if (!executed) {
      // Handle unknown commands or just reset
      setCommandInput("");
      setFocusedSection("search");
    }
  };

  const handleSearchSubmit = (value: string) => {
    setQuery(value);
    setPage(1);
    setCategoryId(undefined);
    setSelectedCategoryName(null);
    performSearch(value, undefined, 1).then(() => {
      // Automatically focus products or categories to allow navigation and commands
      // Prioritize products if available
      setFocusedSection("products"); // Default to products so navigation works immediately
      setProductIndex(0);
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
            const isStarredItem = starredIds.has(item.id);
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
                      {isStarredItem ? "★ " : ""}
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
              Space: Star/Unstar | n: Next Page | p: Prev Page | Right: Open |
              Left: Categories
            </Text>
          </Box>
        </Box>
      </Box>
    );
  };

  const renderDetail = () => {
    if (loadingDetail) {
      return (
        <Box marginTop={1}>
          <Text color="yellow">Loading details...</Text>
        </Box>
      );
    }

    if (!selectedListing) {
      return null;
    }

    return (
      <Box
        flexDirection="column"
        marginTop={1}
        borderStyle="round"
        borderColor="white"
        padding={1}>
        <Text bold color="green">
          {selectedListing.title}
        </Text>
        <Text color="yellow">{selectedListing.priceText}</Text>
        <Text color="dim">ID: {selectedListing.id}</Text>

        <Box marginTop={1}>
          <Text>
            {selectedListing.fullDescription || selectedListing.description}
          </Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text color="cyan">Location: {selectedListing.location}</Text>
          <Text color="cyan">Seller: {selectedListing.sellerName}</Text>
          {selectedListing.paylivery && (
            <Text color="magenta">✓ PayLivery Available</Text>
          )}
        </Box>

        {selectedListing.attributes &&
          Object.keys(selectedListing.attributes).length > 0 && (
            <Box marginTop={1} flexDirection="column">
              <Text bold>Attributes:</Text>
              {Object.entries(selectedListing.attributes).map(([key, val]) => (
                <Text key={key} color="dim">
                  - {key}: {Array.isArray(val) ? val.join(", ") : val}
                </Text>
              ))}
            </Box>
          )}

        <Box marginTop={1}>
          <Text color="dim">Press Left Arrow to go back</Text>
        </Box>
      </Box>
    );
  };

  const renderHistory = () => {
    if (historyItems.length === 0) {
      return (
        <Box marginTop={1}>
          <Text color="dim">No search history.</Text>
        </Box>
      );
    }

    const windowSize = 10;
    const start = Math.floor(historyIndex / windowSize) * windowSize;
    const end = Math.min(start + windowSize, historyItems.length);
    const visibleItems = historyItems.slice(start, end);

    return (
      <Box
        flexDirection="column"
        marginTop={1}
        borderStyle="round"
        borderColor="blue"
        paddingX={1}>
        <Text bold color="blue">
          Search History (Enter to restore):
        </Text>
        {visibleItems.map((item, i) => {
          const actualIndex = start + i;
          const isSelected = actualIndex === historyIndex;
          return (
            <Text
              key={item.id}
              color={isSelected ? "green" : "white"}
              bold={isSelected}>
              {isSelected ? "> " : "  "}
              {item.query}
              {item.categoryName ? ` [${item.categoryName}]` : ""}
              <Text color="dim">
                {" "}
                ({new Date(item.createdAt).toLocaleString()})
              </Text>
            </Text>
          );
        })}
        {historyItems.length > end && <Text color="dim">...more</Text>}
      </Box>
    );
  };

  const renderStarredItems = () => {
    if (starredItemsList.length === 0) {
      return (
        <Box marginTop={1}>
          <Text color="dim">No starred items yet.</Text>
        </Box>
      );
    }

    const windowSize = 10;
    const start = Math.floor(starredIndex / windowSize) * windowSize;
    const end = Math.min(start + windowSize, starredItemsList.length);
    const visibleItems = starredItemsList.slice(start, end);

    return (
      <Box
        flexDirection="column"
        marginTop={1}
        borderStyle="round"
        borderColor="yellow"
        paddingX={1}>
        <Text bold color="yellow">
          Starred Items ({starredItemsList.length}):
        </Text>
        <Box flexDirection="column" marginTop={1}>
          {visibleItems.map((item, i) => {
            const actualIndex = start + i;
            const isSelected = actualIndex === starredIndex;
            const borderColor = isSelected ? "green" : "gray";

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
          {starredItemsList.length > end && (
            <Text color="dim" italic>
              ...and {starredItemsList.length - end} more
            </Text>
          )}
          <Box marginTop={1}>
            <Text color="dim">Space: Unstar | Enter: Details | Esc: Back</Text>
          </Box>
        </Box>
      </Box>
    );
  };

  const renderUserProfile = () => {
    if (loadingProfile) {
      return (
        <Box marginTop={1}>
          <Text color="yellow">Loading profile...</Text>
        </Box>
      );
    }

    if (!userProfile) {
      return (
        <Box marginTop={1} flexDirection="column">
          <Text color="red">Not authenticated or failed to load profile.</Text>
          <Text color="dim">
            (In this environment, you likely don't have valid cookies)
          </Text>
        </Box>
      );
    }

    return (
      <Box
        flexDirection="column"
        marginTop={1}
        borderStyle="round"
        borderColor="magenta"
        paddingX={1}>
        <Text bold color="magenta">
          User Profile
        </Text>
        <Box flexDirection="column" marginTop={1}>
          <Text>
            <Text bold>Name:</Text> {userProfile.displayName}
          </Text>
          <Text>
            <Text bold>Email:</Text> {userProfile.email}
          </Text>
          <Text>
            <Text bold>ID:</Text> {userProfile.id}
          </Text>
          {userProfile.postCode && (
            <Text>
              <Text bold>Location:</Text> {userProfile.postCode}{" "}
              {userProfile.city}
            </Text>
          )}
          {userProfile.memberSince && (
            <Text>
              <Text bold>Member Since:</Text> {userProfile.memberSince}
            </Text>
          )}
        </Box>
        <Box marginTop={1}>
          <Text color="dim">Esc: Back</Text>
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

      {/* Import SearchBar component */}
      <SearchBar
        query={query}
        setQuery={setQuery}
        onSubmit={handleSearchSubmit}
        focused={focusedSection === "search"}
        history={searchHistory}
        historyFocused={historyFocused}
        onHistoryFocus={setHistoryFocused}
      />

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

      {searchResult && focusedSection !== "detail" && (
        <Box flexDirection="column" marginTop={1}>
          {renderCategories()}
          {renderProducts()}
        </Box>
      )}

      {focusedSection === "detail" && renderDetail()}

      {focusedSection === "history" && renderHistory()}

      {focusedSection === "starred" && renderStarredItems()}

      {focusedSection === "me" && renderUserProfile()}

      {focusedSection === "command" && (
        <Box
          marginTop={1}
          borderStyle="round"
          borderColor="yellow"
          flexDirection="column">
          <Box>
            <Text color="yellow">COMMAND: </Text>
            <TextInput
              value={commandInput}
              onChange={setCommandInput}
              onSubmit={handleCommandSubmit}
              focus={true}
            />
          </Box>
          <Box marginTop={0}>
            {getCommandNames()
              .filter((c) => c.startsWith(commandInput))
              .map((c) => (
                <Text key={c} color="dim">
                  {c}{" "}
                </Text>
              ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
