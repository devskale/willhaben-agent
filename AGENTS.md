# Willhaben CLI (whcli) — Development Guidelines

A JSON-first CLI for interacting with willhaben.at, designed for agent automation.
Auth via Chrome cookies (`sweet-cookie`), image CDN is fully public (no auth).

## Quick Start

```bash
pnpm install
pnpm start -- search "iphone 15"
pnpm start -- view 12345678
pnpm start -- auth
```

## Commands

| Command | Description |
|---------|-------------|
| `search <query>` | Search listings (supports filters, sort, text output) |
| `view <adId>` | Get listing details |
| `view <adId> --images` | Get 1 preview image URL |
| `view <adId> --all-images` | Get all image URLs (deduped, `_hoved` quality) |
| `seller <userId>` | Get seller info |
| `auth` | Check authentication status |
| `auth --cdp` | Check auth via Chrome DevTools |
| `tree [categoryId]` | Browse category tree |
| `wishlist list` | Show search wishlist |
| `wishlist add <q> [--description] [--category] [--max-price] [--notes]` | Add to wishlist |
| `wishlist remove <id>` | Remove from wishlist |
| `wishlist toggle <id>` | Activate/deactivate |
| `locations` | List Austrian states (Bundesländer) |
| `favorites list` | List local starred items (SQLite) |
| `favorites download` | Download merkliste from willhaben (all items) |
| `favorites download --csv` | Download merkliste as CSV |
| `history` | Show search history with stats |
| `help` | Show usage |

## Search Flags

| Flag | Description |
|------|-------------|
| `--category <id>` | Filter by category ID |
| `--location <ids>` | Comma-separated area IDs (e.g., `900,1,3`) |
| `--page <n>` | Page number |
| `--sort <mode>` | `price-asc`, `price-desc`, `newest` |
| `--max-price <amount>` | Client-side max price filter |
| `--private` | Filter private sellers only (fetches details per item) |
| `--text` | Pretty table output |
| `--json` | JSON output (default) |

## Examples

```bash
# Search with filters
whcli search "pixel" --category 2722 --sort price-asc --max-price 200 --text

# Only private sellers
whcli search "boot kabine" --category 5007823 --private --sort price-asc --text

# View images
whcli view 1909835075 --images          # 1 preview
whcli view 1909835075 --all-images      # all photos

# Category browsing
whcli tree                              # Root categories
whcli tree 2691                         # Smartphones/Telefonie
whcli tree 2691 --keyword pixel         # Filtered

# Location + category combo
whcli search "pixel" --location 900 --category 2722

# Wishlist
whcli wishlist add "pixel xl" --category 2722 --max-price 100 --notes "Google Photos unlimited"
whcli wishlist list

# Favorites / Merkliste (auth required)
whcli favorites download                # JSON, all items
whcli favorites download --csv > list.csv  # CSV export
```

## Output Format

All commands output **JSON by default** for agent consumption:

```json
{
  "items": [...],
  "totalFound": 123,
  "categories": [...]
}
```

Errors: `{ "error": "message" }`

## Project Structure

```
willhaben/
├── src/
│   ├── cli.ts              # CLI entry point + auth router + command dispatch
│   ├── types.ts            # Shared TypeScript interfaces
│   ├── agents/
│   │   ├── auth.ts         # Auth via sweet-cookie (getVisitorCookies + checkAuth)
│   │   ├── search.ts       # Search router (marktplatz + immo)
│   │   ├── search-marktplatz.ts  # Marktplatz search, view, seller
│   │   ├── search-immo.ts       # Immobilien search, overview
│   │   ├── merkliste.ts    # Merkliste download (SSR HTML parsing)
│   │   ├── messaging.ts    # Chat/messaging API
│   │   ├── db.ts           # SQLite: favorites, history, wishlist, categories, regions
│   │   ├── locations.ts    # Bundesland/Bezirk data
│   │   └── user.ts         # User profile
│   └── lib/
│       ├── cli-helpers.ts  # Flag parsing, formatters, filter builders
│       ├── analysis.ts     # Stats, compare, best deals
│       ├── cdpCookies.ts   # Chrome DevTools Protocol cookie extractor (fallback)
│       ├── imageUtil.ts    # Generic image downloader
│       └── price.ts        # Price parsing utilities
├── api.md                  # Discovered API endpoints + Image CDN docs
├── DEVGUIDE.md             # How to add new commands
├── package.json
└── tsconfig.json
```

## Database Schema (SQLite: `willhaben.db`, gitignored)

| Table | Purpose |
|-------|---------|
| `starred_items` | Saved/favorited listings |
| `search_history` | Query, totalFound, priceMin, priceMax, areaId |
| `wishlist` | Search queries to watch (with category, max-price, notes) |
| `categories` | 3-level hierarchy (root → sub → brand), with counts |
| `regions` | Bundesländer + Bezirke (area_id, parent_id, name, level) |

## Code Style

- **Imports:** ES modules with `.js` extension (`import { x } from "./agents/auth.js"`)
- **TypeScript:** `strict: true`, explicit interfaces, no `any`
- **Errors:** Return `{ error: "message" }`, exit code 1
- **Formatting:** 2-space indent, single quotes, trailing commas

## Building & Testing

```bash
pnpm run type-check    # tsc --noEmit
pnpm run build         # Build to dist/
pnpm test              # vitest
```

## Auth & Smart Router

Two auth levels, enforced by the router in `cli.ts`:

| Route | Function | Use for |
|-------|----------|---------|
| **Public** | `getVisitorCookies()` | search, tree, view, images, seller, locations |
| **Auth** | `checkAuth()` + `getVisitorCookies()` | favorites, message, chats |

Auth uses `@steipete/sweet-cookie` which reads Chrome's cookie DB directly.
- Set `CHROME_PROFILE` env var (default: `Default`)
- `whcli auth` checks login status
- `--cdp` flag available as fallback if sweet-cookie can't read cookies

For adding new commands, see **[`DEVGUIDE.md`](DEVGUIDE.md)** — covers API reverse engineering via Chrome DevTools MCP, auth levels, and the full command-building workflow.

## Image CDN

Images are **fully public** — no auth needed. URL schema documented in `api.md`.

```bash
# Download a single image
curl -sL --compressed "<image_url>" -H "Referer: https://www.willhaben.at/" -o photo.jpg
```
