# whcli - Willhaben.at CLI

A JSON-first command-line interface for [willhaben.at](https://www.willhaben.at), designed for agent automation.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)](https://nodejs.org)

## Features

- **JSON Output**: All commands output JSON by default for easy agent consumption
- **Category Tree Navigation**: Browse nested category hierarchy
- **Location Filtering**: Filter results by Austrian states
- **Listing Details**: Get full listing info including seller, price, attributes
- **Favorites**: Manage starred items in local SQLite database
- **History**: Track search history

## Installation

```bash
npm install
```

## Usage

```bash
npm start -- <command> [options]
```

## Commands

| Command | Description |
|---------|-------------|
| `tree [id]` | Browse category tree (optional: drill into category ID) |
| `search <query>` | Search listings |
| `view <adId>` | Get listing details |
| `seller <userId>` | Get seller info |
| `locations` | List Austrian states for location filtering |
| `favorites list` | List starred items |
| `history` | Show search history |
| `auth` | Check authentication status |
| `help` | Show usage |

## Flags

| Flag | Description |
|------|-------------|
| `--category <id>` | Filter by category |
| `--location <ids>` | Filter by state IDs (comma-separated) |
| `--keyword <q>` | Filter category tree by keyword |
| `--page <n>` | Page number |
| `--json` | Output as JSON (default) |

## Examples

```bash
# Browse category tree
whcli tree
whcli tree 2691                     # Smartphones / Telefonie
whcli tree 2722 --keyword pixel     # Smartphones filtered by "pixel"

# Search with filters
whcli search "pixel" --category 5014404 --location 900,1,3
# Search Pixel 7 in Vienna, Burgenland, Niederösterreich

# Get listing details
whcli view 12345678

# Check authentication
whcli auth
```

## Location IDs

| ID | State |
|----|-------|
| 1 | Burgenland |
| 2 | Kärnten |
| 3 | Niederösterreich |
| 4 | Oberösterreich |
| 5 | Salzburg |
| 6 | Steiermark |
| 7 | Tirol |
| 8 | Vorarlberg |
| 900 | Wien |

## Authentication

Uses browser cookies via `sweet-cookie` to authenticate with willhaben.at. Supports Chrome, Edge, Firefox, and Safari.

## Tech Stack

- **TypeScript** for type safety
- **better-sqlite3** for local storage
- **sweet-cookie** for authentication
- **cheerio** for HTML parsing

## License

MIT
