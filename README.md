# whcli — Willhaben.at CLI

JSON-first CLI for [willhaben.at](https://www.willhaben.at), built for agent automation.

## Quick Start

```bash
pnpm install
pnpm start -- search "iphone 15"
```

## Commands

| Command | Description |
|---------|-------------|
| `search <query>` | Search listings (supports filters, sort, text output) |
| `view <adId>` | Get listing details |
| `view <adId> --images` | Get 1 preview image URL |
| `view <adId> --all-images` | Get all image URLs |
| `images <adId>` | List/download listing images |
| `images <adId> --dir <path> --download` | Download all photos to disk |
| `seller <userId>` | Get seller info |
| `auth` | Check authentication status |
| `tree [id]` | Browse category tree |
| `wishlist list` | Show search wishlist |
| `locations` | List Austrian states |
| `favorites list` | List starred items |
| `favorites download` | Download merkliste (JSON) |
| `favorites download --csv` | Download merkliste as CSV |
| `favorites summary` | Merkliste summary (count, total, top/bottom) |
| `favorites folders` | List merkliste folders |
| `favorites save <adId> [--folder <name>]` | Save ad to folder |
| `favorites remove <adId>` | Remove ad from merkliste |
| `favorites create-folder <name>` | Create new folder |
| `history` | Show search history |
| `car [query]` | Search cars (filters: `--max-price`, `--sort`, `--text`) |
| `moto [query]` | Search motorcycles |
| `van [query]` | Search vans/SUVs |
| `caravan [query]` | Search caravans/RVs |
| `similar <query>` | Find similar products (e.g. `similar "pixel 4a"`) |
| `similar <adId>` | Seller-based similar listings |
| `similar <adId> --item` | Item-based similar listings |
| `overview [--location] [--type]` | Immobilien market snapshot (median price, €/m² per district) |
| `analyze <query> --vertical immobilien` | Real estate analysis (by type, best value, private sellers) |
| `version` / `-v` | Show version |

## Search Flags

| Flag | Description |
|------|-------------|
| `--category <id>` | Filter by category ID |
| `--location <ids>` | Comma-separated area IDs (e.g., `900,1,3`) |
| `--page <n>` | Page number |
| `--sort <mode>` | `price-asc`, `price-desc`, `newest` |
| `--max-price <amount>` | Client-side max price filter |
| `--private` | Filter private sellers only |
| `--text` | Pretty table output |
| `--json` | JSON output (default) |

## Examples

```bash
# Search with filters
whcli search "pixel" --category 2722 --sort price-asc --max-price 200 --text

# Only private sellers
whcli search "boot kabine" --category 5007823 --private --sort price-asc --text

# View images
whcli view 1909835075 --images          # 1 preview URL
whcli view 1909835075 --all-images      # all image URLs

# Download images to disk (for visual inspection)
whcli images 1909835075 --dir ./photos --download
# → downloads all images, returns JSON with file paths
# → then use `read` tool on each .jpg file to view visually

# Category browsing
whcli tree                              # Root categories
whcli tree 2691                         # Smartphones/Telefonie
whcli tree 2691 --keyword pixel         # Filtered

# Location + category combo
whcli search "pixel" --location 900 --category 2722

# Vehicle search
whcli car "golf" --max-price 5000 --text
whcli moto "enduro" --max-price 3000 --sort price-asc --text
whcli van "sprinter" --location 900 --text

# Similar / alternative products
whcli similar "pixel 4a"              # find similar products
whcli similar 2097858592              # same seller's other listings
whcli similar 2097858592 --item       # content-based (same brand/price)
```

## Auth

Uses browser cookies via [`sweet-cookie`](https://github.com/nicedoc/sweet-cookie). Supports Chrome, Edge, Firefox, Safari.

Set `CHROME_PROFILE` env var to pick a Chrome profile (default: `Default`).

## Tech Stack

TypeScript · better-sqlite3 · sweet-cookie · cheerio

## License

MIT
