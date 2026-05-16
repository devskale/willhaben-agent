# Refactor Plan — whcli

## P0 — Extract CLI god file + shared constants

### Constants
- [x] Created `src/lib/constants.ts`, replaced all 7 duplicated files, type-check passes

### Command extraction
- [ ] Create `src/commands/shared.ts` (output, parseArgs, getFormat, OutputFormat type)
- [ ] Create `src/commands/search.ts` (cmdSearch + printSearchTable)
- [ ] Create `src/commands/view.ts` (cmdView + cmdImages)
- [ ] Create `src/commands/favorites.ts` (cmdFavorites — all subcommands)
- [ ] Create `src/commands/vehicles.ts` (cmdVehicleSearch)
- [ ] Create `src/commands/similar.ts` (cmdSimilar + cmdSellerSimilar + cmdProductSimilar + cmdSimilarItems)
- [ ] Create `src/commands/analyze.ts` (cmdAnalyze + cmdCompare)
- [ ] Create `src/commands/overview.ts` (cmdOverview)
- [ ] Create `src/commands/chats.ts` (cmdMessage + cmdChats)
- [ ] Create `src/commands/misc.ts` (cmdAuth, cmdSeller, cmdLocations, cmdHistory, cmdWishlist, cmdTree, cmdHelp)
- [ ] Rewrite `src/cli.ts` as thin dispatcher (~150 lines: imports, auth router, switch)
- [ ] Type-check passes
- [ ] Smoke test: search, favorites, vehicles, similar, auth all still work
- [ ] Commit + push

### Target structure
```
src/commands/
├── shared.ts        # output(), parseArgs(), getFormat(), OutputFormat
├── search.ts        # cmdSearch + printSearchTable
├── view.ts          # cmdView + cmdImages
├── favorites.ts     # cmdFavorites (all subcommands)
├── vehicles.ts      # cmdVehicleSearch
├── similar.ts       # cmdSimilar + cmdSellerSimilar + cmdProductSimilar + cmdSimilarItems
├── analyze.ts       # cmdAnalyze + cmdCompare
├── overview.ts      # cmdOverview
├── chats.ts         # cmdMessage + cmdChats
└── misc.ts          # cmdAuth, cmdSeller, cmdLocations, cmdHistory, cmdWishlist, cmdTree, cmdHelp
```

---

## P1 — Shared HTTP helpers + API response types

- [ ] Create `src/lib/http.ts`
  - [ ] `getPublicHeaders()` — visitor cookies only
  - [ ] `getAuthHeaders()` — checkAuth + visitorCookies + CSRF + numeric userId extraction
- [ ] Replace auth header building in `search-marktplatz.ts`
- [ ] Replace auth header building in `search-immo.ts`
- [ ] Replace auth header building in `search-vehicles.ts`
- [ ] Replace auth header building in `merkliste.ts` (getWebapiHeaders)
- [ ] Replace auth header building in `messaging.ts`
- [ ] Replace auth header building in `similar.ts`
- [ ] Replace auth header building in `similar-item.ts`
- [ ] Replace auth header building in `similar-product.ts`
- [ ] Create `src/types-api.ts` — type the raw willhaben JSON shapes at the parsing boundary
- [ ] Type-check passes
- [ ] Smoke test
- [ ] Commit + push

---

## P2 — DB migrations + tests

### DB
- [ ] Add `schema_version` table to `db.ts`
- [ ] Create `src/db/migrations/` directory with numbered migration files
- [ ] Replace scattered `CREATE TABLE` try/catch blocks with migration runner
- [ ] Type-check passes
- [ ] Smoke test (existing DB still works)

### Tests
- [ ] Merkliste HTML parsing (various page layouts)
- [ ] Vehicle category resolution (fuzzy matching)
- [ ] Price scoring (similar-product)
- [ ] Auth header building (http.ts)
- [ ] Search filter building (cli-helpers.ts)
- [ ] Commit + push
