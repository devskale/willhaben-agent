# willhaben-tui

A React-based Terminal User Interface for browsing willhaben.at.

## Features

- **Search**: Search willhaben.at directly from the terminal.
- **Category Filtering**: Drill down into categories to refine results.
- **Product Details**: View detailed information including price, location, and seller.
- **Favorites**: Star products to save them locally (SQLite).
- **History**: Access your recent searches.
- **Authentication**: Uses your browser's cookies (Chrome, Edge, Firefox, Safari) via `sweet-cookie`.
- **Keyboard Navigation**: Efficient keyboard-only control.

## Getting Started

```bash
# Install dependencies
npm install

# Start the TUI
npm start
```

## Controls

### Navigation

- **Up / Down**: Navigate lists (categories, products, history).
- **Enter**: Select item / View details.
- **Left Arrow**: Go back (from details to list).
- **Right Arrow**: Filter by selected category (in category list).
- **Escape**: Clear selection / Go back.

### Product List

- **Space**: Star / Unstar selected product.
- **n**: Next page.
- **p**: Previous page.

### Commands

Press `/` to enter command mode.

- `/search`: Jump to search input.
- `/history`: View search history.
- `/quit`: Exit the application.

## Requirements

- Node.js 18+
- A browser with willhaben.at session cookies (Chrome, Edge, Firefox, or Safari) for authenticated features.
- Terminal with color support.
