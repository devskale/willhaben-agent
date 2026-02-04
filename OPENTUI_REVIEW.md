# Willhaben TUI - OpenTUI Review

## Executive Summary

The willhaben TUI project uses **Ink** (React for CLIs), **not OpenTUI**. While both use React, they have significant differences in:

- **Runtime**: Willhaben uses Node.js + tsx; OpenTUI requires Bun
- **Framework**: Willhaben uses `ink` package; OpenTUI uses `@opentui/react`
- **Components**: Different component APIs and styling models
- **Exit handling**: Willhaben uses `process.exit()`; OpenTUI requires `renderer.destroy()`

---

## Critical Issues (Based on OpenTUI Guidelines)

### 1. Wrong Runtime Environment

**OpenTUI Requirement:** Must use **Bun**, not Node.js

```bash
# WRONG (current setup)
npm start  # Uses Node.js v24

# CORRECT (OpenTUI)
bun run src/index.tsx
```

**Impact:**
- OpenTUI uses Zig for native builds → Won't work with Node.js
- Bun APIs are expected throughout (e.g., `bun:sqlite` instead of `better-sqlite3`)

---

### 2. Using process.exit() Directly

**OpenTUI Rule:** Never use `process.exit()` directly. Use `renderer.destroy()` instead.

**Current Code (app.tsx:6):**
```tsx
const { exit } = useApp();
// Later called via command context
```

**OpenTUI Approach:**
```tsx
// Get renderer instance
const renderer = useRenderer()

// On exit, destroy first
if (shouldExit) {
  renderer.destroy()  // Cleans up terminal state
  // process.exit(1)  // Only after destroy, if needed
}
```

**Impact:** May leave terminal in broken state (raw mode, alternate screen).

---

### 3. Using wrong SQLite library

**OpenTUI Recommendation:** Use `bun:sqlite` instead of `better-sqlite3`

**Current Code (package.json):**
```json
"better-sqlite3": "^12.6.0"
```

**OpenTUI Approach:**
```ts
import { Database } from "bun:sqlite"
const db = new Database("willhaben.db")
```

**Impact:** `better-sqlite3` requires native compilation and prebuilt binaries. `bun:sqlite` is built into Bun.

---

### 4. Component API Incompatibility

**Issue:** Using Ink components (`ink`, `ink-text-input`, `ink-select-input`) instead of OpenTUI components.

**Current Imports:**
```tsx
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
```

**OpenTUI Components:**
```tsx
import { createRoot } from "@opentui/react"

// Use lowercase intrinsic elements
<box border padding={2}>
  <text>Hello</text>
</box>
```

**Impact:** All JSX components would need to be rewritten.

---

## Architecture Review (vs OpenTUI Patterns)

### ✅ Good Patterns (Compatible with OpenTUI)

| Pattern | Willhaben | OpenTUI | Notes |
|---------|-----------|----------|-------|
| React hooks for state | `useState` | `useState` | ✅ Compatible |
| Async data loading | `useEffect` + async | Same pattern | ✅ Compatible |
| Keyboard handling | `useInput` | `useKeyboard` | Similar, different API |
| Component composition | Nested JSX | Same | ✅ Compatible |
| Windowing for lists | Custom logic | Could use `<scrollbox>` | Similar approach |

### ❌ Anti-Patterns (OpenTUI Perspective)

| Issue | Willhaben | OpenTUI Guidance |
|-------|-----------|------------------|
| Single massive component | `app.tsx` = 650 lines | Split into focused components |
| No useReducer for complex state | Multiple `useState` | Better for complex transitions |
| Inline styles | String colors like `"green"` | Object style props preferred |
| No context for global state | Props drilling | Use React Context |
| Manual layout calculations | Custom windowing | Use Yoga layout |

---

## Specific Code Issues

### 1. Keyboard Handling (app.tsx: ~80-280 lines)

**Current (Ink):**
```tsx
useInput((input, key) => {
  if (key.escape) { /* ... */ }
  if (key.upArrow) { /* ... */ }
})
```

**OpenTUI:**
```tsx
useKeyboard((key) => {
  if (key.name === "escape") { /* ... */ }
  if (key.name === "up") { /* ... */ }
})
```

**Issues:**
- Key names differ (`upArrow` vs `up`)
- Need to handle `eventType` for key repeat
- `useKeyboard` is more powerful (release events, modifiers)

---

### 2. Text Styling (throughout)

**Current (Ink):**
```tsx
<Text color="green">Text</Text>
<Text bold>Bold</Text>
```

**OpenTUI:**
```tsx
<text fg="#00FF00">Text</text>
<text><strong>Bold</strong></text>
```

**Critical Rule:** OpenTUI requires **nested modifier tags** for styling, not props:
```tsx
// WRONG
<text bold>Bold</text>

// CORRECT
<text><strong>Bold</strong></text>
```

---

### 3. Layout & Positioning

**Current (Ink - somewhat similar):**
```tsx
<Box flexDirection="row" justifyContent="space-between">
```

**OpenTUI:** Same Yoga layout properties, but lowercase:
```tsx
<box flexDirection="row" justifyContent="space-between">
```

**Note:** Most layout properties are compatible, but OpenTUI uses lowercase elements.

---

### 4. Input Components

**Current (Ink packages):**
```tsx
<TextInput
  value={query}
  onChange={setQuery}
  onSubmit={handleSearchSubmit}
  focus={focusedSection === "search"}
/>
```

**OpenTUI:**
```tsx
<input
  value={query}
  onChange={setQuery}
  onSubmit={handleSearchSubmit}
  focused={focusedSection === "search"}
  width={40}
  backgroundColor="#1a1a2a"
/>
```

---

## Migration Path: Ink → OpenTUI

### Step 1: Install OpenTUI

```bash
bunx create-tui -t react willhaben-opentui
cd willhaben-opentui
bun install
```

### Step 2: Migrate Dependencies

```bash
# Remove Ink packages
bun remove ink ink-select-input ink-text-input better-sqlite3 tsx react

# Add OpenTUI
bun install @opentui/react @opentui/core
```

### Step 3: Rewrite Entry Point

**Current (cli.tsx):**
```tsx
#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import App from './app.js';

render(<App />);
```

**OpenTUI:**
```tsx
import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import App from "./app"

const renderer = await createCliRenderer({ exitOnCtrlC: true })
createRoot(renderer).render(<App />)
```

### Step 4: Migrate Components

| Ink Component | OpenTUI Component | Notes |
|--------------|-------------------|-------|
| `<Box>` | `<box>` | Lowercase |
| `<Text>` | `<text>` | Lowercase, use nested modifiers |
| `<TextInput>` | `<input>` | More styling options |
| `ink-select-input` | `<select>` | Different API |
| `useInput()` | `useKeyboard()` | Different event object |

### Step 5: Migrate Database

```ts
// Replace
import Database from "better-sqlite3"

// With
import { Database } from "bun:sqlite"

// Syntax is similar but API has minor differences
```

### Step 6: Fix Exit Handling

```tsx
// Replace all
process.exit()

// With
const renderer = useRenderer()
renderer.destroy()
```

---

## Recommendations

### For Staying with Ink

If you **don't want to migrate** to OpenTUI, here are improvements aligned with TUI best practices:

1. **Add ESLint** (per your own AGENTS.md)
2. **Split `app.tsx`** into smaller components:
   - `SearchBar.tsx`
   - `CategoryList.tsx`
   - `ProductList.tsx`
   - `DetailView.tsx`
   - `CommandPalette.tsx`

3. **Use useReducer** for complex state:
   ```tsx
   type AppState = { focusedSection: FocusedSection, ... }
   type Action = { type: "FOCUS", section: FocusedSection } | ...
   const [state, dispatch] = useReducer(reducer, initialState)
   ```

4. **Add React Context** for global state (auth, database)

### For Migrating to OpenTUI

**Pros:**
- Better performance (Zig native code)
- Bun runtime (faster, built-in SQLite)
- More powerful layout (Yoga)
- Better animations and testing

**Cons:**
- Requires complete rewrite of JSX
- Learning curve for new API
- Requires Bun (Node.js not supported)

**Estimated Effort:** 2-3 days for full migration

---

## OpenTUI Checklist for Current Project

| OpenTUI Requirement | Status | Notes |
|---------------------|----------|-------|
| Use Bun runtime | ❌ | Currently on Node.js v24 |
| Use @opentui/react | ❌ | Using Ink |
| Use bun:sqlite | ❌ | Using better-sqlite3 |
| Use renderer.destroy() | ❌ | Uses process.exit() |
| Use nested text modifiers | ❌ | Uses color props |
| Use lowercase JSX elements | ❌ | Uses PascalCase |
| Use useKeyboard() | ❌ | Uses useInput() |
| Split into small components | ⚠️ | Single 650-line file |

---

## Conclusion

The willhaben project is well-architected for an **Ink-based TUI**, but it's not compatible with OpenTUI without significant refactoring. The choice depends on:

- **Keep Ink**: If the project works and performance is acceptable
- **Migrate to OpenTUI**: If you need better performance, native animations, or want to adopt the Bun ecosystem

If you want to migrate, I can help with a step-by-step conversion plan or start a new OpenTUI-based version.
