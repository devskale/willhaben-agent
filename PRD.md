# Willhaben CLI PRD

A minimalistic CLI tool to interact with the willhaben.at marketplace.

## 1. Overview

The Willhaben CLI is designed for power users to automate and streamline their interaction with the willhaben.at marketplace. It focuses on searching for items, automated messaging, and tracking interaction statistics.

## 2. Core Features

### 2.1 Authentication

- **Mechanism**: Integration with `sweet-cookie` library.
- **Goal**: Seamless session management without manual login for every session.

### 2.2 Marketplace Search

- **Functionality**: Search for items across the marketplace.
- **Workflow**:
  1. **Initial Search**: User enters a keyword (e.g., "pixel 4a").
  2. **Category Selection**: System presents a list of relevant categories ranked by the number of hits. User selects one or multiple categories.
  3. **Results**: System displays items from the selected categories.
- **Saved Searches**:
  - **Functionality**: Users can save a search configuration (keyword + selected categories).
  - **Storage**: Local persistence (e.g., `saved-searches.json`).
- **Parameters**: Support for keywords, categories, price ranges, and location.
- **Output**: List of items with key details (title, price, link, seller info).

### 2.3 Messaging System

- **Functionality**: Send messages directly to sellers for specific items.
- **Templates**: Support for predefined message templates to speed up inquiries.
- **Safety**: Rate limiting to avoid being flagged as spam.

### 2.4 Statistics & Insights

- **Functionality**: View stats on sent messages, items found, and successful interactions.
- **Visualization**: Simple table-based views or summary reports in the terminal.

## 3. Technical Requirements

- **Runtime**: Node.js (>= 22) or Bun (required by `sweet-cookie`).
- **Language**: TypeScript.
- **Auth Library**: `@steipete/sweet-cookie`.
- **CLI Framework**:
  - **Option A (Recommended)**: **Ink** (React for CLIs). Best for building complex TUI layouts (dashboards, lists) similar to Bubble Tea.
  - **Option B**: **Commander** + **@inquirer/prompts**. Best for linear, prompt-based interactions.
  - **Decision**: Use **Ink** to achieve the "dashboard" feel for stats and search results.

## 4. Success Metrics

- Successfully authenticate using `sweet-cookie`.
- Retrieve search results accurately from Willhaben.
- Successfully send a message to a seller via the CLI.
- Display basic stats in the terminal.
