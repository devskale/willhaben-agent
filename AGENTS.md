# Willhaben CLI (whcli) - Development Guidelines

A JSON-first CLI for interacting with willhaben.at, designed for agent automation. Uses the `sweet-cookie` library for authentication.

## Quick Start

```bash
# Install dependencies
npm install

# Run CLI
npm start -- <command>

# Examples
npm start -- search "iphone 15"
npm start -- view 12345678
npm start -- auth
```

## Commands

| Command | Description |
|---------|-------------|
| `search <query>` | Search for listings |
| `view <adId>` | Get listing details |
| `seller <userId>` | Get seller info |
| `auth` | Check authentication status |
| `favorites list` | List starred items |
| `favorites add --data '<json>'` | Add to favorites |
| `favorites remove --data '<json>'` | Remove from favorites |
| `history` | Show search history |
| `help` | Show usage |

## Flags

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON (default) |
| `--text` | Output as plain text |
| `--category <id>` | Filter by category (search) |
| `--page <n>` | Page number (search) |

## Output Format

All commands output **JSON by default** for easy agent consumption:

```json
{
  "items": [...],
  "totalFound": 123,
  "categories": [...]
}
```

Errors are also JSON:

```json
{
  "error": "Missing search query"
}
```

## Project Structure

```
willhaben/
├── src/
│   ├── cli.ts              # CLI entry point
│   ├── types.ts            # Shared TypeScript interfaces
│   └── agents/
│       ├── auth.ts         # Authentication via sweet-cookie
│       ├── search.ts       # Search and parsing logic
│       ├── db.ts           # SQLite database for favorites/history
│       └── user.ts         # User preferences
├── package.json
└── tsconfig.json
```

## Code Style Guidelines

### Imports
- Use ES modules with `.js` extension in imports (e.g., `import { checkAuth } from "./agents/auth.js"`)
- Group imports: external libraries first, then internal modules

### TypeScript
- Enable `strict: true` in tsconfig.json
- Use explicit interfaces for complex objects (e.g., `AuthState`, `SearchItem`)
- Avoid `any` types; use `unknown` and type guards when uncertain

### Error Handling
- Return JSON error objects: `{ error: "message" }`
- Exit with code 1 on errors
- Use try/catch for async operations

### Formatting
- 2-space indentation
- Single quotes for strings
- Trailing commas in multi-line objects/arrays

## Testing

```bash
# Run all tests
npm test

# Watch mode
npx vitest
```

## Building

```bash
# Type check
npm run type-check

# Build to dist/
npm run build
```

## Important Notes

- Auth uses Chrome/Edge/Firefox/Safari cookies via `sweet-cookie`
- Search parses `__NEXT_DATA__` from willhaben.at HTML
- Node.js ESM mode (`"type": "module"` in package.json)
- Run `npx tsc --noEmit` before committing to catch type errors
- TUI version preserved on `tui` and `feature/opentui` branches
