# Willhaben Internal API Reference

> Discovered via Chrome DevTools MCP — live network interception on willhaben.at (2026-05-12)
>
> **Willhaben has NO public documented API.** All endpoints below are internal/undocumented,
> discovered by intercepting browser network traffic and inspecting `__NEXT_DATA__` payloads.
> Use at your own risk — URLs, params, and response shapes may change without notice.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Public APIs (No Auth)](#public-apis-no-auth)
3. [Internal REST API (`api.willhaben.at`)](#internal-rest-api-apiwillhabenat)
4. [Search APIs (`webapi` + `ad-search.willhaben.at`)](#search-apis-webapi--ad-searchwillhabenat)
5. [Messaging & Chat APIs](#messaging--chat-apis)
6. [Analytics / Event Logging APIs](#analytics--event-logging-apis)
7. [AdTech / DAC APIs](#adtech--dac-apis)
8. [Required Headers & Auth](#required-auth--auth)
9. [Discovery Methodology](#discovery-methodology)

---

## Architecture Overview

Willhaben uses **three distinct API domains**:

```
┌─────────────────────────────────┐
│  publicapi.willhaben.at          │  ← Public, no auth needed
│  /atdetail/v1/{id}              │
│  /userprofile/trust-signals/{id}│
│  /jobs/v2/startpage             │
└──────────┬──────────────────────┘
           │
┌──────────▼──────────────────────┐
│  api.willhaben.at/restapi/v2/    │  ← Internal REST, needs cookies + CSRF
│  /atverz/{id}                   │     (the "real" backend)
│  /dealerprofile/{orgId}         │
│  /search/atz/...                │
│  /categorytree/{id}            │
│  /recommendation/search/...     │
│  /userfolders/...               │
│  /reportad/{id}                 │
│  /logevent/...                  │
└──────────┬──────────────────────┘
           │
┌──────────▼──────────────────────┐
│  www.willhaben.at/webapi/        │  ← Web-facing API layer
│  /ad-search/search/atz/...      │     (used by the Next.js frontend)
│  /iad/messaging/...             │
│  /iad/recommendation/...        │
│  /chat-api/v1/conversations     │
│  /iad/cms/bbx/...               │
│  /dac/...                       │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  ad-search.willhaben.at/         │  ← Search infrastructure
│  /restapi/v2/vertical/{id}      │
│  /restapi/v2/searchconfig/{id}  │
└─────────────────────────────────┘
```

**How the current whcli works vs what's available:**

| Feature | Current Approach | Better API Available |
|---------|-----------------|---------------------|
| Search | Scrape HTML → parse `__NEXT_DATA__` | `webapi/ad-search/search/atz/...` (JSON) |
| Listing details | Scrape HTML → parse `__NEXT_DATA__` | `publicapi/atdetail/v1/{id}` (clean JSON) |
| Seller info | `publicapi/userprofile/trust-signals/{id}` | ✅ already using this |
| Category tree | Scrape HTML → parse `__NEXT_DATA__` | `api/restapi/v2/categorytree/{id}` |
| Recommendations | Not implemented | `api/restapi/v2/recommendation/search/{adId}/{orgId}` |
| Messaging | `webapi/iad-messaging/sendrequest/chat` | ✅ already using this |
| Chat/Conversations | `webapi/chat-api/v1/conversations` | ✅ already using this |
| Dealer profiles | Not implemented | `api/restapi/v2/dealerprofile/{orgId}` |
| Search by dealer | Not implemented | `api/restapi/v2/search/atz/{vert}/{rows}?orgId={id}` |

---

## Public APIs (No Auth)

### Ad Detail

```
GET https://publicapi.willhaben.at/atdetail/v1/{adId}
```

**Example:** `https://publicapi.willhaben.at/atdetail/v1/1889167855`

Returns full listing detail as clean JSON. No cookies or auth required.

**Use case:** Replace the current HTML-scraping approach in `getListingDetails()`.

---

### Seller Trust Signals / Profile

```
GET https://publicapi.willhaben.at/userprofile/trust-signals/{userId}
```

**Example:** `https://publicapi.willhaben.at/userprofile/trust-signals/26123355`

Returns:
```json
{
  "userName": "...",
  "rating": { "averageRating": 4.8, "ratingCount": 123 },
  "responseTime": { "label": "within 1 hour" },
  "verificationStatus": { "verified": true },
  "userType": "PRIVATE" | "PROFESSIONAL",
  "location": "Wien",
  "memberSince": "2020-01-15"
}
```

**Status:** ✅ Already used in `search.ts` → `getSeller()`

---

### Jobs Startpage

```
GET https://publicapi.willhaben.at/jobs/v2/startpage
```

Returns jobs-related start page data.

---

## Internal REST API (`api.willhaben.at`)

> **Requires:** Cookies + CSRF token (see [Required Headers](#required-auth--auth))

### Ad Detail (Authenticated)

```
GET https://api.willhaben.at/restapi/v2/atverz/{adId}
GET https://api.willhaben.at/restapi/v2/atverz/{seoPath}
```

**Examples:**
- `https://api.willhaben.at/restapi/v2/atverz/1889167855`
- `https://api.willhaben.at/restapi/v2/atverz/kaufen-und-verkaufen/d/apple-iphone-16-pro-max-256gb-gold-werksoffen-neuwertig-1889167855/`

Returns richer ad data than the public endpoint when authenticated. Includes all attributes, images, seller info, context links.

**Key fields in response:**
```json
{
  "id": "1889167855",
  "verticalId": 5,
  "advertStatus": { "id": "active", "statusId": 50 },
  "description": "Apple iPhone 16 Pro Max ...",
  "attributes": {
    "attribute": [
      { "name": "PRICE/AMOUNT", "values": ["819.0"] },
      { "name": "PRICE_FOR_DISPLAY", "values": ["€ 819"] },
      { "name": "LOCATION", "values": ["Wien, 07. Bezirk, Neubau"] },
      { "name": "POSTCODE", "values": ["1070"] },
      { "name": "ORGNAME", "values": ["Cashy GmbH"] },
      { "name": "ORGID", "values": ["21158748"] },
      { "name": "ORG_UUID", "values": ["c83fc933-cf78-451e-a2bc-e2c91a4831c9"] },
      { "name": "HEADING", "values": ["Apple iPhone 16 Pro Max ..."] },
      { "name": "BODY_DYN", "values": ["Full description text..."] },
      { "name": "COORDINATES", "values": ["48.20703,16.3453"] },
      { "name": "ADTYPE_ID", "values": ["68"] },
      { "name": "ISPRIVATE", "values": ["0"] },
      { "name": "IS_BUMPED", "values": ["1"] },
      { "name": "CATEGORYTREEIDS", "values": ["2691;2722;2724;5014411"] }
    ]
  },
  "advertImageList": {
    "advertImage": [{
      "mainImageUrl": "https://cache.willhaben.at/mmo/...",
      "thumbnailImageUrl": "https://cache.willhaben.at/mmo/..._thumb.jpg"
    }]
  },
  "contextLinkList": {
    "contextLink": [
      { "id": "selfLink", "uri": "https://api.willhaben.at/restapi/v2/atverz/1889167855" },
      { "id": "adDetailLink", "uri": "https://publicapi.willhaben.at/atdetail/v1/1889167855" },
      { "id": "iadShareLink", "uri": "https://www.willhaben.at/iad/object?adId=1889167855" }
    ]
  }
}
```

---

### Image Metadata

```
GET https://api.willhaben.at/restapi/v2/atimage/{adId}/{imageId}
```

**Example:** `https://api.willhaben.at/restapi/v2/atimage/1889167855/1`

Returns image URLs (main, thumbnail, reference) for a specific ad image.

---

### Dealer / Organization Profile

```
GET https://api.willhaben.at/restapi/v2/dealerprofile/{orgId}
```

**Example:** `https://api.willhaben.at/restapi/v2/dealerprofile/21158748`

Returns dealer/shop profile data (commercial sellers).

**Status:** 🆕 Not yet implemented in whcli

---

### Search Ads by Dealer

```
GET https://api.willhaben.at/restapi/v2/search/atz/{verticalId}/{rows}?orgId={orgId}
```

**Example:** `https://api.willhaben.at/restapi/v2/search/atz/5/30?orgId=21158748`

Search for all ads from a specific dealer/organization.

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `verticalId` | int | Vertical/category group ID (e.g., `5` = marketplace) |
| `rows` | int | Number of results to return |
| `orgId` | int | Organization (dealer) ID |

**Status:** 🆕 Not yet implemented in whcli

---

### Category Tree

```
GET https://api.willhaben.at/restapi/v2/categorytree/{productId}?adStatus={statusId}
```

**Example:** `https://api.willhaben.at/restapi/v2/categorytree/68?adStatus=50`

Returns category tree configuration for a product type.

**Status:** 🆕 Could replace the HTML-scraping `getCategoryTree()` in `search.ts`

---

### Similar Listings / Recommendations

```
GET https://api.willhaben.at/restapi/v2/recommendation/search/{adId}/{orgId}?absoluteImageUrls=true
```

**Example:** `https://api.willhaben.at/restapi/v2/recommendation/search/1889167855/21158748?absoluteImageUrls=true`

Returns "similar listings" (Ähnliche Anzeigen) for a given ad. Response shape matches search results with `advertSummaryList`.

**Response structure:**
```json
{
  "id": -1,
  "heading": "Ähnliche Anzeigen",
  "rowsFound": 10,
  "rowsReturned": 10,
  "advertSummaryList": { "advertSummary": [...] }
}
```

**Status:** 🆕 Not yet implemented in whcli

---

### User Folders (Favorites / Saved Items)

```
POST https://api.willhaben.at/restapi/v2/userfolders/remove/{adId}
GET  https://api.willhaben.at/restapi/v2/userfolders/links/{adId}
```

Manage saved/favorited listings via the official API (currently whcli uses local SQLite).

---

### Report an Ad

```
POST https://api.willhaben.at/restapi/v2/reportad/{adId}
```

Report a listing.

---

## Search APIs (`webapi` + `ad-search.willhaben.at`)

### Search Endpoint (JSON API) 🔑

```
GET https://www.willhaben.at/webapi/ad-search/search/atz/{type}/{verticalId}/{path}/{area}/sort/{sortId}?{params}
GET https://www.willhaben.at/webapi/ad-search/search/atz/seo/{seoPath}?{params}
```

**This is the REAL search API** — returns structured JSON, no HTML scraping needed.

**Observed examples from live traffic:**

```
# Top ads for a vertical area
GET /webapi/ad-search/search/atz/5/301/atverz?rows=3&TOP_AD=topad_result&sort=11&b_keyword=iphone

# SEO-based search with filters
GET /webapi/ad-search/search/atz/seo/kaufen-und-verkaufen/marktplatz/regale-kaesten/kommoden-anrichten-5719/a/zustand-neu-22?
    keyword=midcentury+OR+50er+OR+60er
    &PRICE_FROM=100
    &treeAttributes=23
    &treeAttributes=2539
    &treeAttributes=2546
    &topicId=1001
    &rows=9
```

**Known query parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `keyword` | string | Search terms (supports `OR`, space-separated) |
| `rows` | int | Number of results (default ~30-50) |
| `PAGE` | int | Page number (1-based) |
| `sort` | int | Sort option ID (e.g., `7`=relevance, `11`=date) |
| `TOP_AD` | string | Set `topad_result` to include promoted ads |
| `b_keyword` | string | Backend keyword (seems same as keyword) |
| `PRICE_FROM` | int | Minimum price in EUR |
| `PRICE_TO` | int | Maximum price in EUR |
| `treeAttributes` | int | Category/filter attribute IDs (repeatable) |
| `topicId` | int | Topic/category filter |
| `areaId` | int | Location/area filter (Austrian state IDs) |
| `adSeparatorSeen` | boolean | Whether "new since last visit" separator was seen |
| `noPersoFor` | int | Exclude personalization for ad ID |

**URL path patterns:**
- `/atz/{verticalId}/{areaId}/atverz` — by vertical + area
- `/atz/seo/{seoPath}` — by SEO path (category slugs)
- `/atz/seo/{seoPath}/a/{areaId}` — SEO path + area
- `/atz/seo/{seoPath}/a/{areaId}/sort/{sortId}` — SEO + area + sort

**Vertical IDs observed:**
| ID | Domain |
|----|--------|
| 1 | Jobs |
| 2 | Vehicles |
| 3 | Real Estate |
| 5 | Marketplace (Marktplatz) |

**Status:** 🆕 Could replace the entire HTML-scraping `searchItems()` function

---

### Search Configuration Infrastructure

```
GET https://ad-search.willhaben.at/restapi/v2/vertical/{verticalId}
GET https://ad-search.willhaben.at/restapi/v2/searchconfig/{verticalId}
```

**Examples:**
- `https://ad-search.willhaben.at/restapi/v2/vertical/5`
- `https://ad-search.willhaben.at/restapi/v2/searchconfig/5`

Returns available filters, sort options, and configuration for each vertical.

**Status:** 🆕 Not yet implemented

---

### Recommendations (WebAPI wrapper)

```
GET https://www.willhaben.at/webapi/iad/recommendation/search/{adId}/{orgId}?absoluteImageUrls=true
```

Same as the `api.willhaben.at` version but through the webapi layer.

---

## Messaging & Chat APIs

### Send Message to Seller

```
POST https://www.willhaben.at/webapi/iad-messaging/sendrequest/chat
Content-Type: application/json
```

**Request body:**
```json
{
  "fromFullName": "Display Name",
  "firstName": "First",
  "lastName": "Last",
  "shareTenantProfile": false,
  "from": "email@example.com",
  "adId": 1984083257,
  "copyToSender": false,
  "showTelephoneNumber": false,
  "telephone": "",
  "selectedContactSuggestions": [],
  "mailContent": "Hallo, ist das noch verfügbar?"
}
```

**Response:**
```json
{
  "sent": true,
  "conversationId": "ff53b956-0147-4691-a9e8-f34d3836beef",
  "message": "Anfrage gesendet!",
  "messageId": "0169650c-d9ef-465d-a220-484d1c5a3b76"
}
```

**Status:** ✅ Already implemented in `messaging.ts` → `sendMessage()`

---

### List Conversations

```
GET https://www.willhaben.at/webapi/chat-api/v1/conversations?limit=50&offset=0
```

**Status:** ✅ Already implemented in `messaging.ts` → `getConversations()`

---

### Get Conversation Messages

```
GET https://www.willhaben.at/webapi/chat-api/v1/conversations/{conversationId}/messages?limit=50&offset=0
```

**Status:** ✅ Already implemented in `messaging.ts` → `getMessages()`

---

## Analytics / Event Logging APIs

> These fire automatically during browsing. Probably not useful for CLI features,
> but good to know about for understanding the full API surface.

```
POST /webapi/iad/logevent/atz/{adId}/top-atz-result-page-viewed
POST /webapi/iad/logevent/atz/{adId}/ad-shared
POST /api.willhaben.at/restapi/v2/logevent/ad/{adId}/call
POST /api.willhaben.at/restapi/v2/logevent/atz/{adId}/virtual-tour-link-clicked
```

---

## AdTech / DAC APIs

> Advertising, consent, tracking, DMP segments. Not relevant for CLI functionality
> but listed for completeness of the API surface.

```
GET  /webapi/dac/version/config/web
GET  /webapi/dac/config/web/{configId}
POST /webapi/dac/advertisingmetrics/counter?metricName=ADBLOCKER_NOT_DETECTED
GET  /webapi/interceptor/recommendations/dmpsegments
GET  /webapi/iad/cms/bbx/v2/cdn/datasource_entries?datasource=dmp-segments&per_page=1000
```

---

## Required Headers & Auth

### Unauthenticated Requests (Public API)

Only needs a standard user-agent:

```
Accept: application/json
User-Agent: Mozilla/5.0 ...
```

### Authenticated Requests (Internal APIs)

All requests to `api.willhaben.at` and `www.willhaben.at/webapi/` need:

```
# CSRF token (from cookie or initial page response)
x-bbx-csrf-token: <csrf-token-from-cookie>

# Client identification
x-wh-client: api@willhaben.at;responsive_web;server;1.0.0;desktop

# Standard headers
Accept: application/json
Accept-Language: de-AT,de;q=0.9,en;q=0.8
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ...

# Cookies (from willhaben session)
Cookie: IADVISITOR=<visitor-id>;
       x-bbx-csrf-token=<csrf-token>;
       TRACKINGID=<tracking-id>;
       context=prod;
       ...
```

### Getting the CSRF Token

The CSRF token is set as a cookie on every response from willhaben. Two ways to get it:

1. **From any response's `Set-Cookie` header** — look for `x-bbx-csrf-token`
2. **From the page's document cookie** — it's included in browser cookies

> ⚠️ **Never commit real tokens, cookies, or session IDs to docs or code.**
> The codebase reads these dynamically from the browser via `sweet-cookie` / CDP.

### Cookie Flow

```
1. GET https://www.willhaben.at/
   → Set-Cookie: IADVISITOR=<uuid>; x-bbx-csrf-token=<token>; ...

2. Extract x-bbx-csrf-token value from cookies

3. Use it in subsequent API calls:
   x-bbx-csrf-token: <token>
   Cookie: IADVISITOR=...; x-bbx-csrf-token=<token>; ...
```

---

## Discovery Methodology

Tools used:
- **Chrome DevTools MCP** (`chrome-devtools-mcp`) — connected via pi-mcp-adapter
- Network request interception on 3 pages:
  1. Homepage (`/iad`)
  2. Search results (`/iad/kaufen-und-verkaufen/marktplatz?keyword=iphone`)
  3. Detail page (`/iad/object?adId=1889167855`)
- `__NEXT_DATA__` JSON extraction from server-rendered pages
- Response body inspection of all `/webapi/` and `/restapi/v2/` endpoints

### How to Re-discover / Verify

```bash
# 1. Start Chrome Beta with remote debugging
"/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta" \
  --remote-debugging-port=9222 &

# 2. Connect MCP (via .mcp.json)
# 3. Navigate to willhaben pages
# 4. List network requests, filter for /webapi/ and /restapi/
# 5. Inspect __NEXT_DATA__ for embedded API URLs
```

### Key Insight: `contextLinkList`

Every ad response includes a `contextLinkList` field that reveals ALL related API endpoints:
```json
"contextLinkList": {
  "contextLink": [
    { "id": "selfLink", "uri": "https://api.willhaben.at/restapi/v2/atverz/{id}" },
    { "id": "adDetailLink", "uri": "https://publicapi.willhaben.at/atdetail/v1/{id}" },
    { "id": "removeAdFromFolder", "uri": "https://api.willhaben.at/restapi/v2/userfolders/remove/{id}" },
    { "id": "getFolderSaveLinks", "uri": "https://api.willhaben.at/restapi/v2/userfolders/links/{id}" },
    { "id": "iadShareLink", "uri": "https://www.willhaben.at/iad/object?adId={id}" }
  ]
}
```

This is a self-documenting API — every ad tells you exactly which endpoints exist for it.

---

## Migration Opportunities

Priority order for upgrading whcli from HTML scraping to proper API calls:

| Priority | Change | Impact |
|----------|--------|--------|
| 🔴 High | Replace `searchItems()` HTML scrape → `webapi/ad-search/search/atz/` | Eliminates cheerio dependency for search, faster, cleaner JSON |
| 🔴 High | Replace `getListingDetails()` HTML scrape → `publicapi/atdetail/v1/{id}` | Same benefits, no auth needed for public data |
| 🟡 Medium | Add `getDealerProfile(orgId)` → `api/restapi/v2/dealerprofile/{orgId}` | New feature |
| 🟡 Medium | Add `getRecommendations(adId)` → `api/restapi/v2/recommendation/search/...` | New feature |
| 🟡 Medium | Replace `getCategoryTree()` HTML scrape → `api/restapi/v2/categorytree/{id}` | Cleaner category data |
| 🟢 Low | Add `searchByDealer(orgId)` → `api/restapi/v2/search/atz/...?orgId=` | Niche feature |
| 🟢 Low | Migrate favorites from local SQLite → `api/restapi/v2/userfolders/...` | Cloud sync capability |
