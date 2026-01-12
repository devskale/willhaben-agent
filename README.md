# willhaben-tui

A React-based Terminal User Interface for browsing willhaben.at.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-blue?logo=react)](https://react.dev)
[![Ink](https://img.shields.io/badge/Ink-6.6-purple)](https://github.com/vadimdemedes/ink)

## Features

- **Search**: Search willhaben.at directly from the terminal.
- **Category Filtering**: Drill down into categories to refine results.
- **Product Details**: View detailed information including price, location, and seller.
- **Favorites**: Star products to save them locally (SQLite).
- **History**: Access your recent searches.
- **Authentication**: Uses your browser's cookies (Chrome, Edge, Firefox, Safari) via `sweet-cookie`.
- **Keyboard Navigation**: Efficient keyboard-only control.

## Installation

```bash
npm install
```

## Usage

```bash
npm start
```

## Controls

### Navigation

| Key | Action |
|-----|--------|
| Up / Down | Navigate lists (categories, products, history) |
| Enter | Select item / View details |
| Left Arrow | Go back (from details to list) |
| Right Arrow | Filter by selected category (in category list) |
| Escape | Clear selection / Go back |

### Product List

| Key | Action |
|-----|--------|
| Space | Star / Unstar selected product |
| n | Next page |
| p | Previous page |

### Commands

Press `/` to enter command mode.

| Command | Description |
|---------|-------------|
| `/search` | Jump to search input |
| `/history` | View search history |
| `/quit` | Exit the application |

## Requirements

- Node.js 18+
- A browser with willhaben.at session cookies (Chrome, Edge, Firefox, or Safari) for authenticated features
- Terminal with color support

## Tech Stack

- **React** + **Ink** for the TUI
- **TypeScript** for type safety
- **better-sqlite3** for local storage
- **sweet-cookie** for authentication
- **cheerio** for HTML parsing

## License

MIT
