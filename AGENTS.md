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
| `favorites summary` | Merkliste summary (count, total, top/bottom items) |
| `favorites folders` | List merkliste folders (with item counts) |
| `favorites create-folder <name>` | Create a new folder |
| `favorites save <adId> [--folder <name\|id>]` | Save ad to folder (default: Merkliste) |
| `favorites remove <adId>` | Remove ad from merkliste |
| `history` | Show search history with stats |
| `car [query]` | Search cars (e.g. `car "golf" --max-price 5000 --text`) |
| `moto [query]` | Search motorcycles (e.g. `moto "enduro" --max-price 3000`) |
| `van [query]` | Search vans/SUVs (e.g. `van "transporter"`) |
| `caravan [query]` | Search caravans/RVs (e.g. `caravan "hymer"`) |
| `immo-filters [--type <type>]` | List available server-side immo filters (run first to discover params) |
| `similar <query>` | Find similar products by name (e.g. `similar "pixel 4a"`) |
| `similar <adId>` | Seller-based similar listings (same seller) |
| `similar <adId> --item` | Item-based similar listings (same category/brand/price) |
| `version` / `-v` / `--version` | Show version |
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
whcli favorites folders                  # list folders
whcli favorites save 2097858592           # save to default folder
whcli favorites save 2097858592 --folder pixel  # save to named folder
whcli favorites remove 2097858592         # remove from merkliste
whcli favorites create-folder myfolder    # create new folder

# Immobilien — discover available server-side filters first
whcli immo-filters                       # default: eigentumswohnung
whcli immo-filters --type haus --text     # filters for Haus kaufen
# Then use discovered params in search:
whcli search "wohnung" --vertical immobilien --type mietwohnung --location 1110 --max-price 1500 --text

# Vehicle search (DB-backed categories + fuzzy filter resolution)
whcli car "golf" --max-price 5000 --text
whcli moto "enduro" --max-price 3000 --sort price-asc --text
whcli van "sprinter" --location 900 --text
whcli caravan "hymer" --text

# Similar / alternative products
whcli similar "pixel 4a"              # find similar products
whcli similar "iphone 13"             # phones competing with iPhone 13
whcli similar 2097858592              # same seller's other listings
whcli similar 2097858592 --item       # content-based (same brand/price)
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
│   │   ├── search-marktplatz.ts  # Marktplatz search, view, seller, getListingDetails
│   │   ├── search-immo.ts       # Immobilien search, overview
│   │   ├── search-vehicles.ts   # Vehicle search (car/moto/van/caravan) — all vertical 3
│   │   ├── merkliste.ts    # Merkliste download (SSR HTML parsing)
│   │   ├── similar.ts      # Seller-based similar listings (recommendation API)
│   │   ├── similar-item.ts # Item-based similarity (search API, multi-strategy scoring)
│   │   ├── similar-product.ts # Product similarity by name (reference profile + broadened search)
│   │   ├── messaging.ts    # Chat/messaging API
│   │   ├── db.ts           # SQLite: favorites, history, wishlist, categories, regions, vehicles
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
| `vehicle_subverticals` | Maps searchId to sub-vertical (2=auto, 4=moto, 50=van, 52=caravan) |
| `vehicle_filter_categories` | All vehicle attribute filters (make, model, fuel, etc.) with fuzzy names |

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

## Viewing Images (for Visual Agents)

### ⚠️ Always use CLI + `read` tool — never Chrome DevTools MCP

When an agent needs to **visually inspect** listing photos (e.g., assess condition of a phone, check damage, compare items), the correct workflow is:

```bash
# Step 1: Download all images for a listing to disk
whcli images <adId> --dir /tmp/photos --download

# Output: JSON with downloaded file paths
# { "adId": "2097858592", "count": 6, "files": ["/tmp/photos/2097858592_000_main.jpg", ...] }
```

Then use the **`read` tool** on each file to view it as an image attachment:
```
read(/tmp/photos/2097858592_000_main.jpg)  → shows image to visual model
read(/tmp/photos/2097858592_001_main.jpg)  → next photo
```

**Why not Chrome DevTools MCP?**
- Screenshots are slow (requires browser navigation per listing)
- Only shows 1 image at a time (the gallery carousel)
- Adds unnecessary complexity and latency
- The CLI downloads all images in one call, then `read` is instant

### Available image commands

| Command | Description |
|---------|-------------|
| `view <adId> --images` | Get 1 preview image URL (JSON) |
| `view <adId> --all-images` | Get all image URLs as JSON array |
| `images <adId>` | List all image URLs + count (JSON) |
| `images <adId> --dir <path> --download` | **Download all images to disk** (recommended for visual inspection) |
| `images <adId> --dir <path> --open` | Download + open in default app |

### Example: Visually compare 3 phone listings

```bash
# Download photos for all 3 listings
for id in 2097858592 1044443639 1312808742; do
  whcli images $id --dir /tmp/phones --download
done

# Then use the `read` tool on each file:
#   read("/tmp/phones/2097858592_000_main.jpg")  → image #1 of listing 1
#   read("/tmp/phones/2097858592_001_main.jpg")  → image #2 of listing 1
#   read("/tmp/phones/1044443639_000_main.jpg")  → image #1 of listing 2
#   ...
```

### Tips for visual inspection
- **2 images per item** is usually enough to judge condition (front + back)
- Check for: screen cracks, body dents, scratches, missing parts, original packaging
- Compare price-to-condition ratio across listings
- File naming: `{adId}_{NNN}_{label}.jpg` — NNN is zero-padded index

## Image CDN

Images are **fully public** — no auth needed. URL schema documented in `api.md`.

```bash
# Download a single image (manual fallback)
curl -sL --compressed "<image_url>" -H "Referer: https://www.willhaben.at/" -o photo.jpg
```
