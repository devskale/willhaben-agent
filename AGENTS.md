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
| `favorites list` | List starred items |
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
│   ├── cli.ts              # CLI entry point + command handlers
│   ├── types.ts            # Shared TypeScript interfaces
│   ├── agents/
│   │   ├── auth.ts         # Auth via sweet-cookie (cross-platform)
│   │   ├── search.ts       # Search, view, images, category tree
│   │   ├── db.ts           # SQLite: favorites, history, wishlist, categories, regions
│   │   ├── locations.ts    # Bundesland/Bezirk data
│   │   └── messaging.ts    # Chat/messaging API
│   └── lib/
│       ├── cdpCookies.ts   # Chrome DevTools Protocol cookie extractor
│       └── imageUtil.ts    # Generic image downloader
├── api.md                  # Discovered API endpoints + Image CDN docs
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

## Chrome Cookie Auth

Cross-platform paths (macOS/Windows/Linux):
- Set `CHROME_PROFILE` env var (default: `Default`)
- `pnpm start -- auth` checks login status
- `pnpm start -- auth --cdp` uses Chrome DevTools Protocol

## Image CDN

Images are **fully public** — no auth needed. URL schema documented in `api.md`.

```bash
# Download a single image
curl -sL --compressed "<image_url>" -H "Referer: https://www.willhaben.at/" -o photo.jpg
```
