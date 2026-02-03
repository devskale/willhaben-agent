# Willhaben TUI - Development Guidelines

A React-based TUI for interacting with willhaben.at, powered by `Ink`. Uses the `sweet-cookie` library for authentication.

## Build Commands

```bash
# Install dependencies
npm install

# Start development server
npm start                  # Runs: tsx src/cli.tsx

# Type checking (run before committing)
npx tsc --noEmit

# Build for production
npm run build              # Compiles TypeScript to dist/
```

## Project Structure

```
willhaben/
├── src/
│   ├── cli.tsx              # Entry point, renders App
│   ├── app.tsx              # Main TUI component with search UI
│   ├── types.ts             # Shared TypeScript interfaces
│   └── agents/
│       ├── auth.ts          # Authentication via sweet-cookie
│       ├── search.ts        # Search and parsing logic
│       ├── db.ts            # SQLite database for favorites/history
│       ├── command.ts       # Command mode parsing
│       └── user.ts          # User preferences
├── package.json
└── tsconfig.json
```

## Code Style Guidelines

### Imports
- Use ES modules with `.js` extension in imports (e.g., `import App from './app.js'`)
- Group imports: React first, then external libraries, then internal modules
- Alphabetize within groups

```typescript
import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { checkAuth } from "./agents/auth.js";
```

### TypeScript
- Enable `strict: true` in tsconfig.json
- Use explicit interfaces for complex objects (e.g., `AuthState`, `SearchItem`)
- Avoid `any` types; use `unknown` and type guards when uncertain
- Define interfaces in the same file as their first usage, or in dedicated types file if shared

### Naming Conventions
- **Interfaces**: PascalCase (e.g., `AuthState`, `SearchResult`)
- **Variables/functions**: camelCase (e.g., `searchItems`, `isAuthenticated`)
- **Constants**: UPPER_SNAKE_CASE or camelCase for config objects
- **Files**: PascalCase for components (e.g., `App.tsx`), kebab-case for utilities

### Error Handling
- Use try/catch for async operations
- Return typed error objects when appropriate
- Convert errors to user-friendly messages
- Never expose internal errors to users without sanitization

```typescript
try {
  const result = await searchItems(value);
  setSearchResult(result);
} catch (e) {
  setError(e instanceof Error ? e.message : "Unknown search error");
}
```

### React Patterns
- Use hooks for state: `useState`, `useEffect`, `useCallback`
- Destructure props and state for readability
- Keep components focused; extract complex logic to agents
- Use TypeScript generics for reusable hooks if needed

### Async/Await
- Always handle promise rejections with try/catch
- Avoid unnecessary async wrappers
- Use `finally` for cleanup

### Formatting
- 2-space indentation
- Single quotes for strings
- Trailing commas in multi-line objects/arrays
- No comments unless clarifying complex logic

### File Structure Rules
- One main export per file (e.g., `export default function App()`)
- Helper functions below main export
- Keep files under 150 lines when possible
- Use `.tsx` for React components, `.ts` for pure TypeScript

## Ink TUI Guidelines

- Use `useInput` for keyboard handling
- Escape key clears state: `if (key.escape) { ... }`
- Ctrl+C exits naturally; no special handler needed
- Display loading states with colored text
- Use `Box` for layout, `Text` for content

```typescript
useInput((input, key) => {
  if (key.escape) {
    setSearchResult(null);
    setQuery("");
  }
});
```

## Testing

```bash
# Run single test file
npx vitest run src/agents/search.test.ts

# Run all tests
npx vitest run

# Watch mode during development
npx vitest
```

## Linting

No ESLint configured. When adding:
```bash
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npx eslint src/
npx eslint src/ --fix
```

## Common Tasks

### Adding a New Agent
1. Create `src/agents/<name>.ts`
2. Define interfaces for input/output
3. Export async functions with try/catch
4. Import and use in app.tsx

### Modifying Search
- Update `SearchItem` interface in `src/agents/search.ts`
- Modify the ad mapping logic in `searchItems()`
- Update UI display in `app.tsx`

## Important Notes

- Auth uses Chrome/Edge/Firefox/Safari cookies via `sweet-cookie`
- Search parses `__NEXT_DATA__` from willhaben.at HTML
- Node.js ESM mode (`"type": "module"` in package.json)
- Run `npx tsc --noEmit` before committing to catch type errors
