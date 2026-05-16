# Refactor Plan — whcli

## P0 — Extract CLI god file + shared constants ✅

- [x] Created `src/lib/constants.ts`, replaced all 9 duplicated files
- [x] Extracted all cmd* functions into src/commands/ (10 files), rewrote cli.ts as 107-line thin dispatcher
- [x] All smoke tests pass, committed + pushed

---

## P1 — Shared HTTP helpers

### Why
8 agent files build fetch headers inline. Two patterns repeat:
1. **Public**: `getVisitorCookies()` → headers with CSRF + cookie + WH_CLIENT + UA
2. **Auth**: `checkAuth()` + `getVisitorCookies()` → combined cookies + CSRF + numeric userId

The public pattern is ~10 header lines repeated 5x. The auth pattern is ~25 lines repeated in merkliste.ts.
A shared helper removes the duplication and gives a single place to tweak headers.

### What changed from original P1
- **Dropped `types-api.ts`** — the willhaben API is undocumented and reverse-engineered. Investing in response types for something that could change any day is low ROI. The `any` is contained at parsing boundaries and doesn't leak.
- **DB migrations pushed to P3** — 6 tables, no schema changes planned. A migration framework is overkill now.
- **Tests split into own priority level** — worth doing but independent of the HTTP refactor.

### Plan
- [ ] Create `src/lib/http.ts`
  - [ ] `getPublicHeaders()` — visitor cookies, CSRF, WH_CLIENT, UA, Accept
  - [ ] `getAuthHeaders()` — checkAuth + visitor + CSRF + userId extraction
- [ ] Replace in `search-marktplatz.ts` (public searches + auth detail/seller)
- [ ] Replace in `search-immo.ts` (public)
- [ ] Replace in `search-vehicles.ts` (public)
- [ ] Replace in `merkliste.ts` (auth — remove inline getWebapiHeaders)
- [ ] Replace in `messaging.ts` (auth)
- [ ] Replace in `similar.ts` (public)
- [ ] Replace in `similar-item.ts` (public)
- [ ] Replace in `similar-product.ts` (public)
- [ ] Type-check passes
- [ ] Smoke test: search, favorites, vehicles, similar, auth
- [ ] Commit + push

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
