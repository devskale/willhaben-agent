# Refactor Plan — whcli

## P0 — Extract CLI god file + shared constants ✅

- [x] Created `src/lib/constants.ts`, replaced all 9 duplicated files
- [x] Extracted all cmd* functions into src/commands/ (10 files), rewrote cli.ts as 107-line thin dispatcher
- [x] All smoke tests pass, committed + pushed

---

## P1 — Shared HTTP helpers ✅

- [x] Created `src/lib/http.ts` with `getPublicHeaders()`, `getHtmlHeaders()`, `getAuthHeaders()`. Replaced inline header building in 8 agent files. Dropped `types-api.ts` (reverse-engineered API, low ROI for typing). Messaging.ts left alone (unique pattern, single file). All smoke tests pass.

---

## P2 — Tests (revised)

### What changed
Original P2 had 5 targets. Reflected and cut to 3 — the ones that catch real bugs, not just mirror implementation details:
- **Dropped price parsing** — thin wrapper around `@norbulcz/num-parse`, not our bug surface
- **Dropped vehicle category resolution** — needs real SQLite setup, the DB query is straightforward
- **Dropped merkliste HTML parsing** — would need snapshot HTML fixtures that rot fast

### What's left — the real value
- [ ] **Similar product scoring** (similar-product.ts) — pure functions with edge cases (empty refs, price match, keyword overlap). Easy to test, high regression value.
- [ ] **Search listing parsing** (search-marktplatz.ts parseListing/parseAttributes) — the core data extraction from raw API JSON. If attributes rename, tests catch it. Already have 6 tests, add more for attribute edge cases.
- [ ] **Analysis filters** (lib/analysis.ts) — filterByKeyword, excludeByKeyword, filterBySize etc. Pure functions, easy to test, used in search + analyze.
- [ ] Type-check + all tests pass
- [ ] Commit + push

---

## P3 — Future nice-to-haves (not now)

- **DB migrations** — only if we need schema changes. 6 tables doesn't justify a framework.
- **API response types** — only if the API stabilizes or we document it formally.
- **`misc.ts` split** — 157 lines with 7 commands. Fine for now, split if it grows.
- **Price parsing tests** — if we ever replace `@norbulcz/num-parse`.
- **Merkliste HTML parsing tests** — if we snapshot real HTML and add a CI update job.
- **Vehicle category tests** — if the fuzzy matching gets more complex.
