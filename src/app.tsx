import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRenderer, useKeyboard } from "@opentui/react";
import { checkAuth, AuthState } from "./agents/auth.js";
import { searchItems } from "./agents/search.js";
import { getCommandNames, executeCommand, CommandContext } from "./agents/command.js";
import { toggleStar, getStarredItems, getSearchHistory, addSearchHistory } from "./agents/db.js";
import { SearchResult } from "./types.js";
import { getConfig, ASCII_CHAR_SETS } from "./agents/config.js";
import { SearchField } from "./components/SearchField.js";

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

   const historyMatches = useMemo(() => {
     if (!query.trim()) return [];
     const matches = searchHistory.filter((h) => 
       h.query.toLowerCase().includes(query.toLowerCase())
     );
     const unique = Array.from(new Set(matches.map(m => m.query)));
     return unique.slice(0, 5);
   }, [query, searchHistory]);

  const refreshHistory = useCallback(() => {
    try {
      const history = getSearchHistory();
      setSearchHistory(history);
    } catch {}
  }, []);

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
  const [asciiArt, setAsciiArt] = useState<string | null>(null);

  // Config State
  const [config, setConfig] = useState<{ asciiWidth: number | "auto"; asciiContrast: string }>({
    asciiWidth: "auto",
    asciiContrast: "rotate",
  });

  // Image rotation state
  const [currentContrast, setCurrentContrast] = useState<string>("medium");
  const [rotationInterval, setRotationInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  // Get terminal width for "auto" mode
  const getTerminalWidth = (): number => {
    const cols = process.env.COLUMNS ? parseInt(process.env.COLUMNS) : undefined;
    if (cols && cols > 40) return cols - 10; // Leave margin
    return 60; // Default fallback
  };

  // Image to ASCII conversion
  const imageToAscii = async (imageUrl: string, asciiWidth: number | "auto", asciiChars: string): Promise<string | null> => {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) return null;
      const buffer = await response.arrayBuffer();
      const { writeFile, unlink } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const tempPath = join("/tmp", "img-" + Date.now() + ".jpg");
      await writeFile(tempPath, Buffer.from(buffer));

      try {
        const sharp = (await import("sharp")).default;
        const metadata = await sharp(tempPath).metadata();
        const origWidth = metadata.width || 100;
        const origHeight = metadata.height || 100;

        // Use auto mode to get terminal width
        const maxWidth = asciiWidth === "auto" ? getTerminalWidth() : asciiWidth;
        const aspectRatio = origHeight / origWidth;
        const targetWidth = Math.min(maxWidth, 100);

        // Full image height maintaining aspect ratio (characters are ~2x tall)
        // Use full height without artificial limits
        const charAspect = 0.5; // Terminal chars are taller than wide
        const targetHeight = Math.floor(targetWidth * aspectRatio * charAspect);

        const resizedBuffer = await sharp(tempPath)
          .resize(targetWidth, targetHeight, { fit: "fill" })
          .raw()
          .toBuffer();

        await unlink(tempPath).catch(() => {});

        let ascii = "";
        const chars = asciiChars;

        for (let y = 0; y < targetHeight; y++) {
          let line = "";
          for (let x = 0; x < targetWidth; x++) {
            const idx = (y * targetWidth + x) * 3;
            if (idx >= resizedBuffer.length) {
              line += " ";
              continue;
            }
            const r = resizedBuffer[idx];
            const g = resizedBuffer[idx + 1];
            const b = resizedBuffer[idx + 2];
            const gray = Math.floor((r + g + b) / 3);
            const charIndex = Math.floor((gray / 255) * (chars.length - 1));
            line += chars[charIndex];
          }
          ascii += line + "\n";
        }

        return ascii;
      } catch {
        await unlink(tempPath).catch(() => {});
        return null;
      }
    } catch {
      return null;
    }
  };

  // Load config on mount
  useEffect(() => {
    getConfig().then(setConfig).catch(() => {
      setConfig({ asciiWidth: "auto", asciiContrast: "medium" });
    });
  }, []);

  // Initial Auth Check
  useEffect(() => {
    const initAuth = async () => {
      const result = await checkAuth();
      setAuth(result);
      setLoading(false);
    };
    initAuth();

    // Load db data and show history at startup
    try {
      const starred = getStarredItems();
      setStarredIds(new Set(starred.map((s: any) => s.id)));
      setStarredItemsList(starred);
      refreshHistory();
    } catch (e) {
      console.error("DB error:", e);
    }
  }, [refreshHistory]);

  const performSearch = async (q: string, catId?: string, p: number = 1) => {
    if (!q.trim()) return null;
    setSearching(true);
    setError(null);

    if (p === 1) {
      try {
        addSearchHistory(q, catId);
        refreshHistory();
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

      // Command mode
      if (focusedSection === "command") {
        if (key.name === "escape") {
          setFocusedSection("search");
          setCommandInput("");
        }
        if (key.name === "tab") {
          const match = getCommandNames().find((c) => c.startsWith(commandInput));
          if (match) setCommandInput(match);
        }
        return;
      }

      // Slash: enter command mode
      if (input === "/" && focusedSection !== "search") {
        setFocusedSection("command");
        setCommandInput("/");
        return;
      }

      // Search mode
      if (focusedSection === "search") {
        if (key.name === "escape") {
          setQuery("");
          setSearchResult(null);
          return;
        }

        if (key.ctrl && input === "h") {
          setFocusedSection("history");
          setHistoryIndex(0);
          return;
        }

        if (key.name === "down") {
          if (searchResult?.categories?.length) {
            setFocusedSection("categories");
            setCategoryIndex(0);
          } else if (searchResult?.items?.length) {
            setFocusedSection("products");
            setProductIndex(0);
          }
          return;
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
          setAsciiArt(null);

          // Stop any existing rotation
          if (rotationInterval) {
            clearInterval(rotationInterval);
            setRotationInterval(null);
          }

          import("./agents/search.js").then(({ getListingDetails }) => {
            getListingDetails(item.id)
              .then(async (detail) => {
                setSelectedListing(detail);
                // Convert image to ASCII
                const imageUrl = detail.images?.[0] || detail.imageUrl;
                if (imageUrl) {
                  // Handle rotate mode
                  if (config.asciiContrast === "rotate") {
                    const modes = ["low", "medium", "high"];
                    let modeIndex = 0;
                    setCurrentContrast(modes[modeIndex]);

                    // Generate initial ASCII
                    const chars = ASCII_CHAR_SETS[modes[modeIndex] as keyof typeof ASCII_CHAR_SETS];
                    const ascii = await imageToAscii(imageUrl, config.asciiWidth, chars);
                    setAsciiArt(ascii);

                    // Start rotation interval
                    const interval = setInterval(async () => {
                      modeIndex = (modeIndex + 1) % modes.length;
                      setCurrentContrast(modes[modeIndex]);
                      const newChars = ASCII_CHAR_SETS[modes[modeIndex] as keyof typeof ASCII_CHAR_SETS];
                      const newAscii = await imageToAscii(imageUrl, config.asciiWidth, newChars);
                      setAsciiArt(newAscii);
                    }, 500);
                    setRotationInterval(interval);
                  } else {
                    // Single mode
                    const chars = ASCII_CHAR_SETS[config.asciiContrast as keyof typeof ASCII_CHAR_SETS] || ASCII_CHAR_SETS.medium;
                    const ascii = await imageToAscii(imageUrl, config.asciiWidth, chars);
                    setAsciiArt(ascii);
                    setCurrentContrast(config.asciiContrast);
                  }
                }
              })
              .catch((e) => {
                setError(e instanceof Error ? e.message : "Failed to load details");
              })
              .finally(() => {
                setLoadingDetail(false);
              });
          });
          return;
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
          return;
        }
        if (input === "p" && page > 1) {
          const newPage = page - 1;
          setPage(newPage);
          performSearch(query, categoryId, newPage);
          return;
        }
        if (input === "n") {
          const newPage = page + 1;
          setPage(newPage);
          performSearch(query, categoryId, newPage);
          return;
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
        if (rotationInterval) {
          clearInterval(rotationInterval);
          setRotationInterval(null);
        }
        if (key.name === "escape" || key.name === "left") {
          setFocusedSection(previousSection);
          setSelectedListing(null);
        }
        if (input === " " && selectedListing) {
          const isNowStarred = toggleStar(selectedListing);
          setStarredIds((prev) => {
            const next = new Set(prev);
            if (isNowStarred) next.add(selectedListing.id);
            else next.delete(selectedListing.id);
            return next;
          });
        }
      }
    },
    { release: false }
  );

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

  if (!auth.isAuthenticated && !loading) {
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
      <text fg="dim">
        {loading ? "Checking authentication..." : "Authenticated via sweet-cookie"}
      </text>

      <box flexDirection="column" marginTop={1}>
        <SearchField
          value={query}
          onChange={(value) => setQuery(value)}
          onSubmit={(value) => handleSearchSubmit(value)}
          focused={focusedSection === "search"}
        />
        {focusedSection === "search" && historyMatches.length > 0 && (
          <box flexDirection="column" border borderStyle="single" borderColor="gray">
            {historyMatches.map((item, index) => (
              <text key={item.id} fg="white">
                {item.query}
              </text>
            ))}
          </box>
        )}
        <box marginTop={0}>
          <text fg="dim">
            {query.trim()
              ? "Enter: Search | Esc: Clear"
              : "/: Commands | Ctrl+H: History"}
          </text>
        </box>
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
          <SearchField
            label="COMMAND: "
            value={commandInput}
            onChange={(value) => setCommandInput(value)}
            onSubmit={(value) => handleCommandSubmit(value)}
            focused
          />
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

    const hasImage = (selectedListing.images?.length > 0) || !!selectedListing.imageUrl;
    const imageUrl = selectedListing.images?.[0] || selectedListing.imageUrl;

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

        {/* Image Preview with Bernstein color */}
        {hasImage && (
          <box marginTop={1} flexDirection="column">
            <box flexDirection="row" justifyContent="space-between">
              <text fg="yellow">📷 Image Preview:</text>
              {config.asciiContrast === "rotate" && (
                <text fg="cyan">Mode: {currentContrast}</text>
              )}
            </box>
            <box marginTop={0}>
              {asciiArt ? (
                // Render ASCII art line by line with Bernstein (amber) color
                <box flexDirection="column">
                  {asciiArt.split("\n").filter(line => line.trim()).map((line, i) => (
                    <text key={i} fg="#ffb000">{line}</text>
                  ))}
                </box>
              ) : (
                // Placeholder
                <box flexDirection="column" border borderStyle="rounded" borderColor="gray" padding={1}>
                  <text fg="gray">[ Converting image... ]</text>
                </box>
              )}
            </box>
            {imageUrl && (
              <text fg="dim">
                {imageUrl.substring(0, 60)}...
              </text>
            )}
          </box>
        )}

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
