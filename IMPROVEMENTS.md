# Willhaben TUI - Code Improvements

## Summary of Changes

### 1. Added ESLint

**File**: `.eslintrc.cjs`

```bash
npm run lint          # Run linter
npm run lint:fix    # Auto-fix issues
```

**Rules configured:**
- TypeScript strict mode
- React hooks rules
- Maximum function lines: 50
- Maximum complexity: 15
- Maximum line length: 120

---

### 2. Created Component Library

**Directory**: `src/components/`

Split massive `app.tsx` (793 lines) into focused components:

| Component | Lines | Purpose |
|-----------|-------|---------|
| `SearchBar.tsx` | ~20 | Search input with submit handler |
| `CategoryList.tsx` | ~45 | Category filtering list with windowing |
| `ProductList.tsx` | ~90 | Product grid with windowing |
| `DetailView.tsx` | ~50 | Single product detail view |
| `HistoryView.tsx` | ~40 | Search history viewer |
| `StarredView.tsx` | ~70 | Starred items viewer |
| `UserProfile.tsx` | ~45 | User profile display |
| `CommandPalette.tsx` | ~25 | Command input with autocomplete |

**Benefits:**
- Single responsibility per component
- Easier to test
- Reusable across project
- Better code organization

---

### 3. Created Custom Hooks

**File**: `src/hooks/useKeyboard.ts`

```tsx
export function useAppKeyboard(handler: KeyHandler) {
  useInput((input, key) => {
    handler(input, key);
  });
}

export function useEscape(onEscape: () => void) {
  useInput((input, key) => {
    if (key.escape) onEscape();
  });
}
```

---

### 4. Created App Context (Optional)

**File**: `src/context/AppContext.tsx`

Global state management with useReducer:
- Centralized state updates
- Reduced prop drilling
- Easier testing

**Note**: Not yet integrated - requires additional refactoring.

---

### 5. Fixed ESLint Issues

| Issue | Before | After |
|-------|---------|--------|
| Empty catch blocks | 4 | 0 |
| Unused imports | 5 | 0 |
| Unescaped entities | 3 | 0 |
| `any` types | ~20 | 16 (work in progress) |

---

## New File Structure

```
willhaben/
├── src/
│   ├── app.tsx              # Original (793 lines)
│   ├── app-new.tsx          # Refactored (450 lines) - WIP
│   ├── cli.tsx              # Entry point
│   ├── types.ts             # Type definitions
│   ├── agents/
│   │   ├── auth.ts
│   │   ├── search.ts
│   │   ├── db.ts
│   │   ├── command.ts
│   │   └── user.ts
│   ├── components/           # NEW - Component library
│   │   ├── index.ts
│   │   ├── SearchBar.tsx
│   │   ├── CategoryList.tsx
│   │   ├── ProductList.tsx
│   │   ├── DetailView.tsx
│   │   ├── HistoryView.tsx
│   │   ├── StarredView.tsx
│   │   ├── UserProfile.tsx
│   │   └── CommandPalette.tsx
│   ├── hooks/               # NEW - Custom hooks
│   │   └── useKeyboard.ts
│   └── context/             # NEW - State management
│       └── AppContext.tsx
├── package.json
├── .eslintrc.cjs          # NEW - ESLint config
└── tsconfig.json
```

---

## Next Steps

### Phase 1: Complete Refactoring (Recommended)

1. **Finish `app-new.tsx`**:
   - Fix remaining TypeScript errors
   - Test all interactions
   - Replace `app.tsx` once verified

2. **Integrate AppContext**:
   - Wrap app with `AppProvider`
   - Replace `useState` with `useAppContext`
   - Remove prop drilling

3. **Add unit tests**:
   ```bash
   # Test individual components
   npx vitest src/components/SearchBar.test.tsx
   ```

### Phase 2: Further Improvements

1. **Add state management library** (optional):
   - Zustand or Jotai for simpler state
   - Or continue with Context + useReducer

2. **Add React Query** for data fetching:
   - Better async handling
   - Automatic caching
   - Optimistic updates

3. **Add component stories**:
   - Use Ink's test renderer
   - Visual regression testing

### Phase 3: Performance

1. **Memoization**: Add `React.memo` for list items
2. **Virtual scrolling**: For large product lists
3. **Debounce search**: Delay API calls while typing

---

## Linting Results

### Original `app.tsx`
- 793 lines (single function)
- Complexity: 63 (limit: 15)
- ~25 warnings/errors

### Refactored Components
- Max 90 lines per file (down from 793)
- Max complexity: ~10 (down from 63)
- ~10 warnings (mostly `any` types)

---

## Commands

```bash
# Run linter
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Type checking
npm run type-check

# Run tests
npx vitest run

# Start dev server
npm start
```

---

## Migration to Refactored Code

When `app-new.tsx` is ready:

1. Backup original:
   ```bash
   mv src/app.tsx src/app-old.tsx
   mv src/app-new.tsx src/app.tsx
   ```

2. Test thoroughly:
   ```bash
   npm start
   ```

3. Remove old file if working:
   ```bash
   rm src/app-old.tsx
   ```
