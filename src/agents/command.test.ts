import { describe, it, expect, mock } from "bun:test";
import { executeCommand } from "./command.js";

mock.module("./db.js", () => ({
  getSearchHistory: () => [
    { id: 1, query: "bike", createdAt: "now" },
  ],
  getStarredItems: () => [],
}));

mock.module("./user.js", () => ({
  getUserProfile: async () => ({ id: "user-1" }),
}));

describe("command navigation", () => {
  it("navigates to history and loads items", async () => {
    const setFocusedSection = mock(() => {});
    const setHistoryItems = mock(() => {});
    const setHistoryIndex = mock(() => {});

    await executeCommand("/history", {
      exit: mock(() => {}),
      setCommandInput: mock(() => {}),
      setFocusedSection,
      setHistoryItems,
      setHistoryIndex,
      setStarredItemsList: mock(() => {}),
      setStarredIndex: mock(() => {}),
      setUserProfile: mock(() => {}),
      setIsLoading: mock(() => {}),
      searchInputRef: { current: null },
    });

    expect(setFocusedSection).toHaveBeenCalledWith("history");
    expect(setHistoryItems).toHaveBeenCalledWith([
      { id: 1, query: "bike", createdAt: "now" },
    ]);
    expect(setHistoryIndex).toHaveBeenCalledWith(0);
  });
});
