import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchItems } from "./search.js";
import * as auth from "./auth.js";

// Mock checkAuth
vi.mock("./auth.js", () => ({
  checkAuth: vi.fn(),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("searchItems", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (auth.checkAuth as any).mockResolvedValue({
      isAuthenticated: true,
      cookies: "test-cookie=1",
    });
  });

  it("should extract categories from navigatorGroups (groupedPossibleValues)", async () => {
    const mockHtml = `
      <html>
        <body>
          <script id="__NEXT_DATA__" type="application/json">
            {
              "props": {
                "pageProps": {
                  "searchResult": {
                    "rowsFound": 10,
                    "advertSummaryList": { "advertSummary": [] },
                    "navigatorGroups": [
                      {
                        "id": "attribute_tree",
                        "groupedPossibleValues": [
                          {
                            "possibleValues": [
                              {
                                "label": "Smartphones",
                                "hits": 400,
                                "urlParamRepresentationForValue": [
                                  { "urlParameterName": "ATTRIBUTE_TREE", "value": "2722" }
                                ]
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  "categorySuggestions": []
                }
              }
            }
          </script>
        </body>
      </html>
    `;

    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
    });

    const result = await searchItems("pixel");

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0]).toEqual({
      id: "2722",
      name: "Smartphones",
      count: 400,
    });
  });

  it("should extract categories from navigatorGroups (nested navigatorList)", async () => {
    const mockHtml = `
      <html>
        <body>
          <script id="__NEXT_DATA__" type="application/json">
            {
              "props": {
                "pageProps": {
                  "searchResult": {
                    "rowsFound": 10,
                    "advertSummaryList": { "advertSummary": [] },
                    "navigatorGroups": [
                      {
                        "label": "Group 1",
                        "navigatorList": [
                          {
                            "id": "attribute_tree",
                            "groupedPossibleValues": [
                              {
                                "possibleValues": [
                                  {
                                    "label": "Real Category",
                                    "hits": 123,
                                    "urlParamRepresentationForValue": [
                                      { "urlParameterName": "ATTRIBUTE_TREE", "value": "999" }
                                    ]
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  "categorySuggestions": []
                }
              }
            }
          </script>
        </body>
      </html>
    `;

    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
    });

    const result = await searchItems("pixel");

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0]).toEqual({
      id: "999",
      name: "Real Category",
      count: 123,
    });
  });

  it("should extract categories from navigatorGroups (id=category fallback)", async () => {
    const mockHtml = `
      <html>
        <body>
          <script id="__NEXT_DATA__" type="application/json">
            {
              "props": {
                "pageProps": {
                  "searchResult": {
                    "rowsFound": 10,
                    "advertSummaryList": { "advertSummary": [] },
                    "navigatorGroups": [
                      {
                        "label": "Group 1",
                        "navigatorList": [
                          {
                            "id": "category",
                            "label": "Kategorie",
                            "groupedPossibleValues": [
                              {
                                "possibleValues": [
                                  {
                                    "label": "Fallback Category",
                                    "hits": 55,
                                    "urlParamRepresentationForValue": [
                                      { "urlParameterName": "ATTRIBUTE_TREE", "value": "1234" }
                                    ]
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  "categorySuggestions": []
                }
              }
            }
          </script>
        </body>
      </html>
    `;

    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
    });

    const result = await searchItems("pixel");

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0]).toEqual({
      id: "1234",
      name: "Fallback Category",
      count: 55,
    });
  });

  it("should extract items and categories correctly", async () => {
    const mockHtml = `
      <html>
        <body>
          <script id="__NEXT_DATA__" type="application/json">
            {
              "props": {
                "pageProps": {
                  "searchResult": {
                    "rowsFound": 100,
                    "advertSummaryList": {
                      "advertSummary": [
                        {
                          "id": "123",
                          "description": { "header": "Test Item" },
                          "attributes": {
                            "attribute": [
                              {
                                "name": "PRICE/AMOUNT",
                                "values": ["100"]
                              },
                              {
                                "name": "LOCATION",
                                "values": ["Vienna"]
                              }
                            ]
                          },
                          "advertImageList": {
                            "advertImage": [
                              { "mainImageUrl": "http://example.com/img.jpg" }
                            ]
                          }
                        }
                      ]
                    }
                  },
                  "categorySuggestions": [
                    { "id": "1", "name": "Category 1", "count": 50 },
                    { "id": "2", "name": "Category 2", "count": 20 }
                  ]
                }
              }
            }
          </script>
        </body>
      </html>
    `;

    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
    });

    const result = await searchItems("test");

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: "123",
        title: "Test Item",
        price: 100,
        priceText: "€ 100,00",
        location: "Vienna",
        imageUrl: "http://example.com/img.jpg",
        url: expect.stringContaining("adId=123"),
      })
    );

    expect(result.categories).toHaveLength(2);
    expect(result.categories[0]).toEqual({
      id: "1",
      name: "Category 1",
      count: 50,
    });
    expect(result.totalFound).toBe(100);
  });

  it("should handle empty results gracefully", async () => {
    const mockHtml = `
      <html>
        <body>
          <script id="__NEXT_DATA__" type="application/json">
            {
              "props": {
                "pageProps": {
                  "searchResult": {
                    "rowsFound": 0,
                    "advertSummaryList": {
                      "advertSummary": []
                    }
                  },
                  "categorySuggestions": []
                }
              }
            }
          </script>
        </body>
      </html>
    `;

    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
    });

    const result = await searchItems("empty");

    expect(result.items).toHaveLength(0);
    expect(result.categories).toHaveLength(0);
    expect(result.totalFound).toBe(0);
  });

  it("should include categoryId in URL if provided", async () => {
    const mockHtml = `<html><body><script id="__NEXT_DATA__" type="application/json">{}</script></body></html>`;
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
    });

    try {
      await searchItems("test", "555");
    } catch (e) {
      // Ignore parsing error, we just want to check the URL
    }

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("ATTRIBUTE_TREE=555"),
      expect.any(Object)
    );
  });
});
