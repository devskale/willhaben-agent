# Willhaben CLI PRD

A minimalistic CLI tool to interact with the willhaben.at marketplace.

## 1. Overview

The Willhaben CLI is designed for power users to automate and streamline their interaction with the willhaben.at marketplace. It focuses on searching for items, automated messaging, and tracking interaction statistics.

## 2. Core Features

### 2.1 Authentication

- **Mechanism**: Integration with `sweet-cookie` library.
- **Goal**: Seamless session management without manual login for every session.

### 2.2 Marketplace Search (Implemented)

- **Functionality**: Search for items across the marketplace.
- **Workflow**:
  1. **Initial Search**: User enters a keyword (e.g., "pixel 4a").
  2. **Category Selection**: System presents a list of relevant categories ranked by the number of hits. User selects one or multiple categories.
  3. **Results**: System displays items from the selected categories.
- **Saved Searches & History**:
  - **Functionality**: Automatically tracks search history.
  - **Storage**: Local persistence via SQLite (`willhaben.db`).
- **Parameters**: Support for keywords and categories.
- **Output**: List of items with key details (title, price, link, seller info).

### 2.3 Persistence (New)

- **Functionality**: Local storage for user data.
- **Technology**: SQLite (`better-sqlite3`).
- **Data Stored**:
  - **Starred Items**: Products marked as favorites.
  - **Search History**: Recent search queries and categories.

### 2.4 Messaging System (Planned)

- **Functionality**: Send messages directly to sellers for specific items.
- **Templates**: Support for predefined message templates to speed up inquiries.
- **Safety**: Rate limiting to avoid being flagged as spam.

### 2.5 Statistics & Insights (Planned)

- **Functionality**: View stats on sent messages, items found, and successful interactions.
- **Visualization**: Simple table-based views or summary reports in the terminal.

## 3. Technical Requirements

- **Runtime**: Node.js (>= 22) or Bun (required by `sweet-cookie`).
- **Language**: TypeScript.
- **Auth Library**: `@steipete/sweet-cookie`.
- **Database**: `better-sqlite3` for local persistence.
- **CLI Framework**: **Ink** (React for CLIs).
- **Styling**: `ink` components (`Box`, `Text`) with standard layout properties.

## 4. Success Metrics

- Successfully authenticate using `sweet-cookie`.
- Retrieve search results accurately from Willhaben.
- Persist starred items and search history locally.
- Navigate efficiently using keyboard commands.
- Display basic stats in the terminal (Future).
