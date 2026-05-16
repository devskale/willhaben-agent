# Refactor Plan — whcli

## P0 — Extract CLI god file + shared constants ✅

- [x] Created `src/lib/constants.ts`, replaced all 9 duplicated files
- [x] Extracted all cmd* functions into src/commands/ (10 files), rewrote cli.ts as 107-line thin dispatcher
- [x] All smoke tests pass, committed + pushed

---

## P1 — Shared HTTP helpers ✅

- [x] Created `src/lib/http.ts` with `getPublicHeaders()`, `getHtmlHeaders()`, `getAuthHeaders()`. Replaced inline header building in 8 agent files. Dropped `types-api.ts` (reverse-engineered API, low ROI for typing). Messaging.ts left alone (unique pattern, single file). All smoke tests pass.

---

## P2 — Tests (revised) ✅

- [x] **Similar product scoring** — 17 tests: extractProfile (median, keywords, null prices), scoreItem (price tiers, keyword overlap, phone bonus/penalty, nearby, private, reference)
- [x] **Analysis filters** — 27 tests: filterByKeyword, excludeByKeyword, classifyPropertyType, filterBySize, filterByRooms, filterByPrice
- [x] **Search listing parsing** — skipped: already covered by 6 existing tests in search.test.ts; internal parse functions not exported, duplicating would be code smell

**Total: 56 tests across 4 test files, all passing.**

---

## P3 — Future nice-to-haves (not now)

- **DB migrations** — only if we need schema changes. 6 tables doesn't justify a framework.
- **API response types** — only if the API stabilizes or we document it formally.
- **`misc.ts` split** — 157 lines with 7 commands. Fine for now, split if it grows.
- **Price parsing tests** — if we ever replace `@norbulcz/num-parse`.
- **Merkliste HTML parsing tests** — if we snapshot real HTML and add a CI update job.
- **Vehicle category tests** — if the fuzzy matching gets more complex.
