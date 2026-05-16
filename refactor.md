# Refactor Plan — whcli

## P0 — Extract CLI god file + shared constants ✅

- [x] Created `src/lib/constants.ts`, replaced all 9 duplicated files
- [x] Extracted all cmd* functions into src/commands/ (10 files), rewrote cli.ts as 107-line thin dispatcher
- [x] All smoke tests pass, committed + pushed

---

## P1 — Shared HTTP helpers ✅

- [x] Created `src/lib/http.ts` with `getPublicHeaders()`, `getHtmlHeaders()`, `getAuthHeaders()`. Replaced inline header building in 8 agent files. Dropped `types-api.ts` (reverse-engineered API, low ROI for typing). Messaging.ts left alone (unique pattern, single file). All smoke tests pass.

---

## P2 — Key tests

Tests for the tricky logic — the stuff that's most likely to break silently.

- [ ] Price parsing (lib/price.ts) — commas, dots, ranges, free items
- [ ] Search filter building (lib/cli-helpers.ts) — immo vs marktplatz flags
- [ ] Merkliste HTML parsing — paginate, extract items from SSR HTML
- [ ] Vehicle category resolution — fuzzy matching in db.ts
- [ ] Similar product scoring — keyword overlap, price proximity, type match
- [ ] Commit + push

---

## P3 — Future nice-to-haves (not now)

- **DB migrations** — only if we need schema changes. 6 tables doesn't justify a framework.
- **API response types** — only if the API stabilizes or we document it formally.
- **`misc.ts` split** — 157 lines with 7 commands. Fine for now, split if it grows.
