import React, { useState, useEffect, useCallback } from "react";
import { useRenderer, useKeyboard } from "@opentui/react";
import { checkAuth, AuthState } from "./agents/auth.js";
import { searchItems } from "./agents/search.js";
import { getCommandNames, executeCommand, CommandContext } from "./agents/command.js";
import { toggleStar, getStarredItems, getSearchHistory, addSearchHistory } from "./agents/db.js";
import { SearchResult } from "./types.js";

export function App() {
  const renderer = useRenderer();

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
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);

  // Search History
  const [searchHistory, setSearchHistory] = useState<any[]>([]);
  const [historyFocused, setHistoryFocused] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);

  // Starred Items
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [starredItemsList, setStarredItemsList] = useState<any[]>([]);
  const [starredIndex, setStarredIndex] = useState(0);

  // History
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Command Mode
  const [commandInput, setCommandInput] = useState("");
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Navigation
  const [focusedSection, setFocusedSection] = useState<string>("search");
  const [previousSection, setPreviousSection] = useState<string>("products");
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [productIndex, setProductIndex] = useState(0);

  // Detail View State
  const [selectedListing, setSelectedListing] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Initial Auth Check
  useEffect(() => {
    const initAuth = async () => {
      const result = await checkAuth();
      setAuth(result);
      setLoading(false);
    };
    initAuth();

    // Load db data
    try {
      const starred = getStarredItems();
      const history = getSearchHistory();
      setStarredIds(new Set(starred.map((s: any) => s.id)));
      setStarredItemsList(starred);
      setSearchHistory(history);
    } catch (e) {
      console.error("DB error:", e);
    }
  }, []);

  const performSearch = async (q: string, catId?: string, p: number = 1) => {
    if (!q.trim()) return null;
    setSearching(true);
    setError(null);

    if (p === 1) {
      try {
        addSearchHistory(q, catId);
      } catch {}
    }

    try {
      const result = await searchItems(q, catId, p);
      setSearchResult(result);
      if (p === 1) {
        setProductIndex(0);
        setCategoryIndex(0);
      }
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      return null;
    } finally {
      setSearching(false);
    }
  };

  useKeyboard(
    (key) => {
      const input = key.sequence;

      // Allow delete/backspace to pass through to input components for text editing
      if ((key.name === "backspace" || key.name === "delete") && (focusedSection === "search" || focusedSection === "command")) {
        return; // Let input component handle text deletion
      }

      // Let Enter pass through in search mode for direct input
      if ((key.name === "return" || key.name === "enter") && focusedSection === "search") {
        if (query && query.trim()) {
          handleSearchSubmit(query);
        }
        return;
      }

      if (key.name === "escape") {
        if (focusedSection === "command") {
          setFocusedSection("search");
          setCommandInput("");
          return;
        }
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

      if (input === "/") {
        setFocusedSection("command");
        setCommandInput("/");
        return;
      }

      if (focusedSection === "command") {
        if (key.name === "tab") {
          const match = getCommandNames().find((c) => c.startsWith(commandInput));
          if (match) setCommandInput(match);
        }
      }

      if (focusedSection === "search") {
        // If suggestions exist, navigate with up/down
        const suggestions = getFilteredSuggestions();
        if (suggestions.length > 0) {
          if (key.name === "up") {
            if (!historyFocused) {
              setHistoryFocused(true);
              setSuggestionIndex(0);
            } else {
              setSuggestionIndex((prev) => Math.max(0, prev - 1));
            }
            return;
          }
          if (key.name === "down") {
            if (!historyFocused) {
              setHistoryFocused(true);
              setSuggestionIndex(0);
            } else {
              setSuggestionIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
            }
            return;
          }
          // Enter submits selected suggestion
          if (key.name === "return" || key.name === "enter") {
            if (historyFocused && suggestions[suggestionIndex]) {
              setHistoryFocused(false);
              handleSearchSubmit(suggestions[suggestionIndex].query);
            } else if (query && query.trim()) {
              handleSearchSubmit(query);
            }
            return;
          }
          // Escape closes suggestions (keeps current query)
          if (key.name === "escape") {
            setHistoryFocused(false);
            return;
          }
        }

        // Handle Enter when no suggestions exist
        if (key.name === "return" || key.name === "enter") {
          if (query && query.trim()) {
            handleSearchSubmit(query);
          }
          return;
        }

        // Down to categories/products
        if (key.name === "down") {
          if (searchResult?.categories?.length) {
            setFocusedSection("categories");
            setCategoryIndex(0);
            return;
          } else if (searchResult?.items?.length) {
            setFocusedSection("products");
            setProductIndex(0);
            return;
          }
        }
      } else if (focusedSection === "categories") {
        const categories = [{ id: "all", name: "All Categories", count: 0 }, ...(searchResult?.categories || [])];
        if (key.name === "up") {
          setCategoryIndex((prev) => Math.max(0, prev - 1));
          return;
        }
        if (key.name === "down") {
          setCategoryIndex((prev) => Math.min(categories.length - 1, prev + 1));
          return;
        }
        if (key.name === "left") {
          setFocusedSection("search");
          return;
        }
        if (key.name === "right" || key.name === "return") {
          const selected = categories[categoryIndex];
          const newCatId = selected.id === "all" ? undefined : selected.id;
          setCategoryId(newCatId);
          setSelectedCategoryName(selected.id === "all" ? null : selected.name);
          setPage(1);
          performSearch(query, newCatId, 1).then((result) => {
            if (key.name === "return" || !result?.categories?.length) {
              setFocusedSection("products");
              setProductIndex(0);
            }
          });
          return;
        }
      } else if (focusedSection === "products") {
        const items = searchResult?.items || [];
        if (key.name === "up") {
          setProductIndex((prev) => Math.max(0, prev - 1));
          return;
        }
        if (key.name === "down") {
          setProductIndex((prev) => Math.min(items.length - 1, prev + 1));
          return;
        }
        if (key.name === "left") {
          if (searchResult?.categories?.length) setFocusedSection("categories");
          else setFocusedSection("search");
          return;
        }
        if ((key.name === "right" || key.name === "return") && items[productIndex]) {
          const item = items[productIndex];
          setPreviousSection("products");
          setFocusedSection("detail");
          setLoadingDetail(true);
          import("./agents/search.js").then(({ getListingDetails }) => {
            getListingDetails(item.id)
              .then((detail) => {
                setSelectedListing(detail);
              })
              .catch((e) => {
                setError(e instanceof Error ? e.message : "Failed to load details");
              })
              .finally(() => {
                setLoadingDetail(false);
              });
          });
        }
        if (input === " " && items[productIndex]) {
          const item = items[productIndex];
          const isNowStarred = toggleStar(item);
          setStarredIds((prev) => {
            const next = new Set(prev);
            if (isNowStarred) next.add(item.id);
            else next.delete(item.id);
            return next;
          });
        }
        if (input === "p" && page > 1) {
          const newPage = page - 1;
          setPage(newPage);
          performSearch(query, categoryId, newPage);
        }
        if (input === "n") {
          const newPage = page + 1;
          setPage(newPage);
          performSearch(query, categoryId, newPage);
        }
      } else if (focusedSection === "history") {
        if (key.name === "up") setHistoryIndex((prev) => Math.max(0, prev - 1));
        if (key.name === "down") setHistoryIndex((prev) => Math.min(historyItems.length - 1, prev + 1));
        if (key.name === "escape") setFocusedSection("search");
        if (key.name === "return" && historyItems[historyIndex]) {
          const selected = historyItems[historyIndex];
          setQuery(selected.query);
          setCategoryId(selected.categoryId);
          setSelectedCategoryName(selected.categoryName || null);
          setPage(1);
          setFocusedSection("products");
          performSearch(selected.query, selected.categoryId, 1);
        }
      } else if (focusedSection === "starred") {
        if (key.name === "up") setStarredIndex((prev) => Math.max(0, prev - 1));
        if (key.name === "down") setStarredIndex((prev) => Math.min(starredItemsList.length - 1, prev + 1));
        if (key.name === "escape") setFocusedSection("search");
        if (input === " " && starredItemsList[starredIndex]) {
          const item = starredItemsList[starredIndex];
          toggleStar(item);
          setStarredIds((prev) => {
            const next = new Set(prev);
            next.delete(item.id);
            return next;
          });
          const newList = starredItemsList.filter((i: any) => i.id !== item.id);
          setStarredItemsList(newList);
          if (starredIndex >= newList.length) setStarredIndex(Math.max(0, newList.length - 1));
        }
      } else if (focusedSection === "me") {
        if (key.name === "escape") setFocusedSection("search");
      } else if (focusedSection === "detail") {
        if (key.name === "escape" || key.name === "left") {
          setFocusedSection(previousSection);
          setSelectedListing(null);
        }
      }
    },
    { release: false }
  );

  const getFilteredSuggestions = () => {
    if (query.trim().length === 0) return searchHistory.slice(0, 5);
    return searchHistory.filter((h) => h.query.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
  };

  const handleCommandSubmit = async (value: string) => {
    const cmd = value.trim();
    const context: CommandContext = {
      exit: () => renderer.destroy(),
      setCommandInput,
      setFocusedSection,
      setHistoryItems,
      setHistoryIndex,
      setStarredItemsList,
      setStarredIndex,
      setUserProfile,
      setIsLoading: setLoadingProfile,
      searchInputRef: { current: null },
    };
    await executeCommand(cmd, context);
    if (cmd !== "/search" && cmd !== "/history" && cmd !== "/starred" && cmd !== "/me") {
      setCommandInput("");
      setFocusedSection("search");
    }
  };

  const handleSearchSubmit = (value: string) => {
    if (!value || !value.trim()) return;
    setQuery(value);
    setPage(1);
    setCategoryId(undefined);
    setSelectedCategoryName(null);
    performSearch(value, undefined, 1).then(() => {
      setFocusedSection("products");
      setProductIndex(0);
    });
  };

  if (loading) {
    return (
      <box padding={2}>
        <text fg="yellow">Checking authentication...</text>
      </box>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <box flexDirection="column" padding={2}>
        <text fg="red">Authentication Failed: {auth.error}</text>
        <text>Please login to willhaben.at in your browser.</text>
      </box>
    );
  }

  return (
    <box flexDirection="column" padding={1} width="100%" height="100%">
      <text fg="green">Willhaben CLI</text>
      <text fg="dim">Authenticated via sweet-cookie</text>

      <box flexDirection="column" marginTop={1}>
        <box>
          <text>Search: </text>
          <input
            value={query}
            onChange={(value) => {
              setQuery(value);
              // Auto-select first matching suggestion when typing
              const filtered = searchHistory.filter((h) =>
                h.query.toLowerCase().includes(value.toLowerCase())
              );
              if (filtered.length > 0) {
                setSuggestionIndex(0);
              }
              setHistoryFocused(false);
            }}
            onSubmit={() => {
              // Enter submits selected suggestion if in history, otherwise current query
              const suggestions = getFilteredSuggestions();
              if (historyFocused && suggestions[suggestionIndex]) {
                setQuery(suggestions[suggestionIndex].query);
                setHistoryFocused(false);
                handleSearchSubmit(suggestions[suggestionIndex].query);
              } else if (query && query.trim()) {
                handleSearchSubmit(query);
              }
            }}
            placeholder="Type keyword or select from history..."
            focused={focusedSection === "search"}
          />
        </box>

        {focusedSection === "search" && getFilteredSuggestions().length > 0 && (
          <box flexDirection="column" border borderStyle="single" borderColor={historyFocused ? "green" : "cyan"}>
            <text fg="gray">Recent searches (↑↓ to navigate, Enter to select):</text>
            {getFilteredSuggestions().map((item, index) => (
              <text key={item.id} fg={index === suggestionIndex ? "green" : "white"} bg={index === suggestionIndex && historyFocused ? "gray" : undefined}>
                {index === suggestionIndex ? "▶ " : "  "}
                {item.query}
              </text>
            ))}
            {historyFocused && <text fg="dim">  ↑↓ navigate · Enter select · Esc close</text>}
          </box>
        )}

        {focusedSection === "search" && !getFilteredSuggestions().length && query && (
          <box marginTop={0}>
            <text fg="dim">Press Enter to search, ↓ to browse categories</text>
          </box>
        )}
      </box>

      {searching && (
        <box marginTop={1}>
          <text fg="blue">Searching for "{query}"...</text>
        </box>
      )}

      {error && (
        <box marginTop={1}>
          <text fg="red">Error: {error}</text>
        </box>
      )}

      {searchResult && (
        <box flexDirection="column" marginTop={1}>
          {renderCategories()}
          {renderProducts()}
        </box>
      )}

      {focusedSection === "detail" && renderDetail()}

      {focusedSection === "command" && (
        <box marginTop={1} border borderStyle="rounded" flexDirection="column">
          <box>
            <text fg="yellow">COMMAND: </text>
            <input
              value={commandInput}
              onChange={(value) => setCommandInput(value)}
              onSubmit={() => handleCommandSubmit(commandInput)}
              placeholder="Type command..."
              focused
            />
          </box>
          <box marginTop={0}>
            {getCommandNames().filter((c) => c.startsWith(commandInput)).map((c) => (
              <text key={c} fg="dim">{c} </text>
            ))}
          </box>
        </box>
      )}
    </box>
  );

  function renderCategories() {
    if (!searchResult?.categories.length) return null;
    const categories = [{ id: "all", name: "All Categories", count: 0 }, ...searchResult.categories];
    const isFocused = focusedSection === "categories";
    return (
      <box flexDirection="column" marginBottom={1}>
        <text fg={isFocused ? "green" : "cyan"}>Categories (↓ to products, →/Enter to select):</text>
        <box flexDirection="column" marginTop={0}>
          {categories.slice(0, 8).map((c, i) => (
            <text key={c.id} fg={i === categoryIndex && isFocused ? "green" : "gray"}>
              {i === categoryIndex && isFocused ? "▶ " : "  "}
              {c.name} {c.id !== "all" ? `(${c.count})` : ""}
            </text>
          ))}
        </box>
      </box>
    );
  }

  function renderProducts() {
    if (!searchResult?.items.length) return null;
    const isFocused = focusedSection === "products";
    return (
      <box flexDirection="column" marginTop={1}>
        <text>Found {searchResult.totalFound} items (Page {page}):</text>
        <box flexDirection="column" marginTop={1}>
          {searchResult.items.slice(0, 10).map((item, i) => {
            const isSelected = i === productIndex && isFocused;
            return (
              <box key={item.id} flexDirection="row" justifyContent="space-between">
                <box width="65%">
                  <text fg={isSelected ? "green" : "white"}>
                    {isSelected ? "▶ " : "  "}
                    {starredIds.has(item.id) ? "★ " : ""}
                    {item.title}
                  </text>
                </box>
                <box width="15%">
                  <text fg="green">{item.priceText}</text>
                </box>
                <box width="20%">
                  <text fg="dim">{item.sellerName}</text>
                </box>
              </box>
            );
          })}
        </box>
        <box marginTop={1}>
          <text fg="dim">Space: Star | n/p: Page | ↑↓: Navigate | →/Enter: Details</text>
        </box>
      </box>
    );
  }

  function renderDetail() {
    if (loadingDetail) {
      return (
        <box marginTop={1}>
          <text fg="yellow">Loading details...</text>
        </box>
      );
    }

    if (!selectedListing) {
      return null;
    }

    return (
      <box flexDirection="column" marginTop={1} border borderStyle="rounded" borderColor="white">
        <box flexDirection="row" justifyContent="space-between">
          <box width="75%">
            <text fg="green" bg="black"> {selectedListing.title?.substring(0, 50) || "No title"} </text>
          </box>
          <box width="25%">
            <text fg="cyan">ID: {selectedListing.id}</text>
          </box>
        </box>
        <text fg="yellow">{selectedListing.priceText}</text>
        <box marginTop={1} flexDirection="column">
          <text><strong>Location:</strong> {selectedListing.location}</text>
          <text><strong>Seller:</strong> {selectedListing.sellerName}</text>
          {selectedListing.paylivery && <text fg="magenta">✓ PayLivery Available</text>}
        </box>
        <box marginTop={1}>
          <text fg="dim">←/Esc: Back to list</text>
        </box>
      </box>
    );
  }
}
