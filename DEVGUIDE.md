# whcli Developer Guide

Building new commands for the willhaben CLI. This guide walks through the architecture
and shows how to add a new command end-to-end.

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│  cli.ts                                         │
│  ┌───────────┐  ┌────────────┐  ┌────────────┐  │
│  │ parseArgs │→ │ Auth Router│→ │  Dispatch   │  │
│  └───────────┘  └────────────┘  └──────┬─────┘  │
│                                        │        │
│  ┌─────────────┐  ┌───────────────────┐│        │
│  │cli-helpers  │  │ cmd*() handlers   ││        │
│  │ fmtNum()    │←─│ cmdSearch()       ││        │
│  │ strFlag()   │  │ cmdFavorites()    ││        │
│  │ buildFilters│  │ cmdYourCommand()  ││        │
│  └─────────────┘  └────────┬──────────┘│        │
└────────────────────────────┼────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼─────┐      ┌─────▼──────┐     ┌─────▼──────┐
    │  agents/  │      │   agents/   │     │   agents/   │
    │ search.ts │      │  merkliste  │     │ messaging   │
    │           │      │    .ts      │     │    .ts      │
    └───────────┘      └────────────┘     └────────────┘
         │                   │                   │
    ┌────▼─────────────────────────────────────────────┐
    │  agents/auth.ts                                   │
    │  ┌──────────────┐  ┌──────────────────────────┐  │
    │  │getVisitor    │  │ checkAuth()               │  │
    │  │Cookies()     │  │ → sweet-cookie (Chrome)   │  │
    │  │ = anonymous  │  │ → user session cookies    │  │
    │  └──────────────┘  └──────────────────────────┘  │
    └───────────────────────────────────────────────────┘
```

## Two Auth Levels

Every command is either **public** or **auth-required**. The router in `cli.ts` enforces this:

| Level | What you get | Commands |
|-------|-------------|----------|
| **Public** (`getVisitorCookies()`) | Anonymous CSRF token + session cookie. No login needed. | `search`, `tree`, `view`, `images`, `seller`, `locations`, `analyze`, `compare`, `history` |
| **Auth** (`checkAuth()`) | Chrome session cookies via `sweet-cookie` (reads Chrome's cookie DB directly). | `favorites`, `message`, `chats`, `wishlist` |

Both use `@steipete/sweet-cookie` which reads Chrome's cookie database directly — no browser launch, no CDP, no Puppeteer.

## Key Files

| File | Purpose |
|------|---------|
| `src/cli.ts` | Entry point, arg parser, auth router, command dispatch, `cmd*()` handlers |
| `src/types.ts` | Shared interfaces (`Listing`, `SearchResult`, `ListingDetail`, `Seller`) |
| `src/agents/auth.ts` | `getVisitorCookies()` (public) + `checkAuth()` (auth) |
| `src/agents/search-marktplatz.ts` | Marktplatz search, view, seller — uses visitor cookies |
| `src/agents/merkliste.ts` | Favorites download — uses `checkAuth()` + `getVisitorCookies()` |
| `src/lib/cli-helpers.ts` | `strFlag()`, `numFlag()`, `fmtNum()`, `fmtCur()`, filter builders |
| `src/agents/db.ts` | SQLite for local data (starred items, history, wishlist) |

## How to Add a New Command

### 1. Create your agent module

Put API/fetch logic in `src/agents/your-feature.ts`. Keep it pure data — no CLI formatting.

```ts
// src/agents/your-feature.ts

// Public command → use getVisitorCookies
import { getVisitorCookies } from './auth.js';

export interface YourItem {
  id: string;
  name: string;
}

export async function fetchYourData(param: string): Promise<YourItem[]> {
  const { csrfToken, cookieHeader } = await getVisitorCookies();

  const resp = await fetch(`https://www.willhaben.at/webapi/your-endpoint?param=${param}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 ...',
      'Accept': 'application/json',
      'x-bbx-csrf-token': csrfToken,
      Cookie: cookieHeader,
    },
  });

  if (!resp.ok) throw new Error(`Failed: ${resp.status}`);
  return resp.json();
}
```

For **auth-required** endpoints, use both cookie sources:

```ts
import { checkAuth, getVisitorCookies } from './auth.js';

export async function fetchAuthenticatedData(): Promise<any> {
  const { cookies } = await checkAuth();
  const { csrfToken, cookieHeader: visitorCookies } = await getVisitorCookies();
  const allCookies = [cookies, visitorCookies].filter(Boolean).join('; ');

  const resp = await fetch('https://www.willhaben.at/webapi/auth-endpoint', {
    headers: {
      'Cookie': allCookies,
      'User-Agent': 'Mozilla/5.0 ...',
      'Accept': 'text/html',
      'X-CSRF-Token': csrfToken,
    },
  });
  // ...
}
```

### 2. Register in the auth router

Open `src/cli.ts` and add your command to the correct set:

```ts
// Public — no login needed
const PUBLIC_COMMANDS = new Set([
  'search', 'tree', 'locations', 'view', 'images',
  'analyze', 'compare', 'seller', 'history', 'help',
  'yourcommand',  // ← add here
]);

// OR: Auth-required — needs logged-in user
const AUTH_COMMANDS = new Set([
  'favorites', 'message', 'chats', 'wishlist',
  'yourauthcommand',  // ← add here
]);
```

### 3. Write the cmd handler

In `src/cli.ts`, add your handler function:

```ts
async function cmdYourCommand(
  positional: string[],
  flags: Record<string, string | boolean>,
  format: OutputFormat,
) {
  const param = positional.join(' ');
  if (!param) {
    output({ error: 'Usage: whcli yourcommand <param>' }, format);
    process.exit(1);
  }

  try {
    const items = await fetchYourData(param);
    output(items, format);
  } catch (e) {
    output({ error: e instanceof Error ? e.message : 'Unknown error' }, format);
    process.exit(1);
  }
}
```

### 4. Wire into dispatch switch

```ts
switch (command) {
  // ... existing cases ...
  case 'yourcommand':
    await cmdYourCommand(positional, flags, format);
    break;
}
```

### 5. Add to help text

Update the `COMMANDS` object and `examples` array in `cmdHelp()`.

### 6. CSV output (optional)

If your command should support `--csv`:

```ts
import { itemsToCSV } from './agents/your-feature.js'; // or inline

if (flags.csv === true) {
  console.log(itemsToCSV(items));
} else {
  output(items, format);
}
```

## Patterns & Conventions

### Error Handling
- Return `{ error: "message" }` + `process.exit(1)`
- Never throw — wrap in try/catch

### Output
- `output(data, format)` handles both JSON and text mode
- JSON is default. Use `--text` for pretty tables
- For CSV, write directly to stdout (bypass `output()`)

### Flag Parsing
```ts
const name = strFlag(flags, 'name');          // string or undefined
const count = numFlag(flags, 'count');        // number or undefined
const page = intFlag(flags, 'page');          // integer or undefined
const verbose = boolFlag(flags, 'verbose');   // true/false
```

### Imports
ES modules with `.js` extension (TypeScript convention):
```ts
import { checkAuth } from './auth.js';
```

### SSR HTML Parsing
Many willhaben pages are server-rendered (Next.js). When no JSON API is available:

1. Fetch the HTML page with auth cookies
2. Split by known markers (`data-testid="..."` attributes)
3. Extract data with regex (title from `<h3>`, price from `€` pattern, etc.)
4. Handle pagination via `?page=N`

See `src/agents/merkliste.ts` for a full example.

### API Discovery (Reverse Engineering)

Use **Chrome DevTools MCP** (`chrome-devtools`) to discover unknown API endpoints.
The browser is already logged in, so you see exactly what a real user session sends.

#### Step 1: Open the page

```
chrome_devtools_navigate_page → { url: "https://www.willhaben.at/iad/myprofile/myfindings" }
```

#### Step 2: Capture network traffic

```
chrome_devtools_list_network_requests
```

Look for requests to:
- `www.willhaben.at/webapi/...` → JSON APIs
- `api.willhaben.at/restapi/...` → REST APIs
- `www.willhaben.at/iad/...` → SSR HTML pages

#### Step 3: Inspect interesting requests

```
chrome_devtools_get_network_request → { reqid: "123" }
```

Check response headers + body. Note the full URL, method, and request headers.

#### Step 4: Determine auth level

This is the **key decision** — look at which cookies the request needs:

```
┌─────────────────────────────────────────────────────────────┐
│  Does the endpoint need a logged-in user?                    │
│                                                              │
│  ┌─ NO ──────────────────────┐  ┌─ YES ──────────────────┐  │
│  │ PUBLIC route              │  │ AUTH route              │  │
│  │                           │  │                         │  │
│  │ Agent uses:               │  │ Agent uses:             │  │
│  │ getVisitorCookies()       │  │ checkAuth()             │  │
│  │                           │  │ + getVisitorCookies()   │  │
│  │ Router: PUBLIC_COMMANDS   │  │ Router: AUTH_COMMANDS   │  │
│  │                           │  │                         │  │
│  │ Examples:                 │  │ Examples:               │  │
│  │ search, view, tree,       │  │ favorites, message,     │  │
│  │ seller, locations         │  │ chats                   │  │
│  └───────────────────────────┘  └─────────────────────────┘  │
│                                                              │
│  How to tell? Check with the browser:                        │
│  1. Open an incognito tab → does it still work? → PUBLIC     │
│  2. Response has user-specific data? → AUTH                  │
│  3. Returns 401/403 without session cookie? → AUTH           │
│  4. /webapi/ad-search/* → always PUBLIC                      │
│  5. /iad/myprofile/* → always AUTH                           │
└─────────────────────────────────────────────────────────────┘
```

#### Step 5: Extract data

If no JSON API was found, the data is in the SSR HTML:

```
chrome_devtools_evaluate_script → { function: "() => { ... }" }
```

Check `__NEXT_DATA__` for embedded JSON:
```
chrome_devtools_evaluate_script → { function: "() => JSON.parse(document.getElementById('__NEXT_DATA__').textContent)" }
```

**Typical flow:**
- Page loads → check network requests for API calls
- If no XHR for the data → it's in the SSR HTML
- Parse HTML with regex/string splits on `data-testid` attributes
- Check pagination (`?page=N`) if `advertCount > items on page`
- Verify with `sweet-cookie`: build the fetch, test from CLI

See `src/agents/merkliste.ts` for a complete example of SSR HTML parsing.

### After Reversing: Document in api.md

Once you've discovered and validated an endpoint, **add it to `api.md`** before building the command.
This is the single source of truth for all API knowledge — no re-reversing needed.

Format:
```markdown
### Endpoint Name

\`\``
METHOD https://www.willhaben.at/path/to/endpoint?params
\`\``

**Auth:** public / auth (visitor cookies) / auth (session cookies)
**Format:** JSON / HTML (SSR)

Description of what it returns, notable fields, pagination behavior.

Discovered: 2026-05 via Chrome DevTools MCP
```

This way the next dev doesn't need to reverse the same endpoint again.

## Common Willhaben API Patterns

Discovered via Chrome DevTools MCP. See `api.md` for the full list.

| Endpoint | Auth | Format | Notes |
|----------|------|--------|-------|
| `/webapi/ad-search/search/...` | Visitor cookies | JSON | Search API |
| `/iad/object?adId=<id>` | Visitor cookies | HTML | Listing detail page |
| `/iad/myprofile/myfindings` | Auth + visitor cookies | HTML (SSR) | Merkliste, paginated `?page=N` |
| `/restapi/v2/userfolders/...` | Auth cookies | JSON | Folder management |
| `/webapi/iad/user/statistics` | Auth cookies | JSON | User stats |
| `/webapi/chat-api/v1/...` | Auth cookies | JSON | Messaging |
| `cache.willhaben.at/mmo/...` | **None** | Image | CDN, fully public |

## Testing

```bash
pnpm run type-check    # tsc --noEmit — catch type errors
pnpm test              # vitest
```

## Checklist for New Commands

- [ ] **Reverse the API** via Chrome DevTools MCP
- [ ] **Document in `api.md`** (URL, method, auth level, format, parsing notes)
- [ ] Agent module in `src/agents/your-feature.ts` (pure data logic)
- [ ] Correct auth level: `getVisitorCookies()` or `checkAuth()`
- [ ] Registered in `PUBLIC_COMMANDS` or `AUTH_COMMANDS`
- [ ] `cmd*()` handler in `cli.ts`
- [ ] Wired into `switch (command)` dispatch
- [ ] Help text updated
- [ ] `pnpm run type-check` passes
- [ ] Manual test with `--json` and `--text`
