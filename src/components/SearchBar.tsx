import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { SearchHistoryItem } from "../agents/db.js";

interface SearchBarProps {
  query: string;
  setQuery: (value: string) => void;
  onSubmit: (value: string) => void;
  focused: boolean;
  history: SearchHistoryItem[];
  historyFocused: boolean;
  onHistoryFocus: (focused: boolean) => void;
}

export function SearchBar({
  query,
  setQuery,
  onSubmit,
  focused,
  history,
  historyFocused,
  onHistoryFocus,
}: SearchBarProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);

  // Filter suggestions based on query
  const filteredSuggestions = useMemo(() => {
    if (query.trim().length === 0) {
      return history.slice(0, 5);
    }
    return history
      .filter((h) => h.query.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 5);
  }, [query, history]);

  // Show suggestions when there are matches and input is focused
  const shouldShowSuggestions = useMemo(() => {
    return focused && filteredSuggestions.length > 0 && !historyFocused;
  }, [focused, filteredSuggestions.length, historyFocused]);

  // Reset suggestion index when filtered suggestions change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setSelectedSuggestionIndex(0);
  }, [filteredSuggestions]);

  // Callback to update query without causing effect loop
  const updateQueryFromSuggestion = useCallback((index: number) => {
    const suggestion = filteredSuggestions[index];
    if (suggestion) {
      setQuery(suggestion.query);
    }
  }, [filteredSuggestions, setQuery]);

  // Handle keyboard for suggestions and autocomplete
  useInput((input, key) => {
    if (!focused) return;

    // Tab key: autocomplete to first suggestion
    if (key.tab && showSuggestions && filteredSuggestions.length > 0) {
      const firstSuggestion = filteredSuggestions[0];
      setQuery(firstSuggestion.query);
      onSubmit(firstSuggestion.query);
      setShowSuggestions(false);
      return;
    }

    // Only handle suggestion navigation if suggestions are shown
    if (!showSuggestions) return;

    // Down arrow: select next suggestion from history
    if (key.downArrow) {
      onHistoryFocus(true);
      setSelectedSuggestionIndex(
        (prev) => Math.min(prev + 1, filteredSuggestions.length - 1)
      );
    }

    // Up arrow: select previous suggestion from history
    if (key.upArrow) {
      if (selectedSuggestionIndex === 0) {
        onHistoryFocus(false);
      } else {
        setSelectedSuggestionIndex((prev) => Math.max(prev - 1, 0));
      }
    }

    // Escape: close suggestions
    if (key.escape) {
      setShowSuggestions(false);
      onHistoryFocus(false);
    }

    // Enter: select highlighted suggestion and search
    if (key.return && selectedSuggestionIndex >= 0) {
      const selected = filteredSuggestions[selectedSuggestionIndex];
      if (selected) {
        setQuery(selected.query);
        onSubmit(selected.query);
        setShowSuggestions(false);
        onHistoryFocus(false);
      }
    }
  });

  // Update history focus state
  useEffect(() => {
    onHistoryFocus(historyFocused);
  }, [historyFocused, onHistoryFocus]);

  // Update query when navigating suggestions
  useEffect(() => {
    if (historyFocused && filteredSuggestions[selectedSuggestionIndex]) {
      updateQueryFromSuggestion(selectedSuggestionIndex);
    }
  }, [selectedSuggestionIndex, historyFocused, filteredSuggestions, updateQueryFromSuggestion]);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box>
        <Text>Search: </Text>
        <TextInput
          value={query}
          onChange={(value) => {
            setQuery(value);
            setShowSuggestions(true);
          }}
          onSubmit={(value) => {
            onSubmit(value);
            setShowSuggestions(false);
          }}
          placeholder="Type keyword and press Enter..."
          focus={focused && !historyFocused}
        />
      </Box>

      {shouldShowSuggestions && (
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="cyan"
          paddingX={1}
          marginTop={0}
        >
          <Text color="gray" bold>
            Recent searches:
          </Text>
          {filteredSuggestions.map((item, index) => {
            const isSelected = index === selectedSuggestionIndex;
            return (
              <Box
                key={`suggestion-${item.id}-${index}`}
                flexDirection="row"
                justifyContent="space-between"
              >
                <Text
                  color={isSelected ? "green" : "white"}
                  bold={isSelected}
                >
                  {isSelected ? "> " : "  "}
                  {item.query}
                </Text>
                {item.categoryName && (
                  <Text color="dim" italic>
                    [{item.categoryName}]
                  </Text>
                )}
              </Box>
            );
          })}
          <Box marginTop={0}>
            <Text color="dim">
              Tab: Auto-complete | ↑↓: Navigate | Enter: Select | Esc: Close
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
