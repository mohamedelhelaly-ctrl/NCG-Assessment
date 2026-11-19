# Tests

**229 backend tests** (pytest, real PostgreSQL) and **303 frontend tests** (Vitest and Testing Library). Both suites also run in CI, together with ruff, oxlint, the migration round trip (`upgrade`, `downgrade`, `upgrade`, then `alembic check`) and the production build.

Run them with `pytest` in `backend/` and `npm test` in `frontend/`. Tests never reach a real network: the frontend setup blocks `fetch`, and the backend uses a separate `shop_test` database and an in-memory image store.

## Backend (229)

| File | Tests | What it proves |
|---|---|---|
| `test_auth.py` | 16 | Sign up always makes a customer; one generic error for wrong password, unknown email and disabled account; tokens expire; disabled and deleted users are rejected on every request; rate limits; passwords are stored hashed |
| `test_permissions.py` | 6 | Guests get 401, customers 403 on admin routes, admins pass; the role is read from the database, not the token |
| `test_seed_admin.py` | 3 | The first admin is created once and an existing account is never changed |
| `test_admin_named.py` | 14 | Brand and category CRUD, case-insensitive unique names, blocked deletion with the product count (inactive products count too) |
| `test_admin_products.py` | 16 | Product CRUD with nested tiers, activation needs a tier, filters, search in both languages, pagination, cascade delete (rows and stored files) |
| `test_admin_tiers.py` | 15 | Tier validation (units, price, duplicates), no fixed number of tiers, deleting the last tier deactivates the product, exact fils |
| `test_admin_images.py` | 19 | Real file-type check, size limit, metadata stripped, resize, WebP, 10 per product, reorder sets the main image, no orphaned files on failure |
| `test_public_catalog.py` | 24 | Only active products with tiers are visible, filters combine, search matches product, brand or category in both languages, pagination, per-field language fallback |
| `test_quote.py` | 31 | **2 bundles of the 4-pack at 19.500 = 39.000 and 8 packs**; separate lines per offer; removed, hidden or mismatched offers are flagged and left out of the totals; invalid counts are flagged, never an error |
| `test_cart.py` | 51 | Per-user carts, saving rules, merge adds the same offer (cap 99) and keeps new lines, all-or-nothing, concurrent saves, database constraints, stale lines survive, **idempotent merge** (a replay never double-counts) |
| `test_i18n.py` | 10 | Language header parsing and the per-field fallback |
| `test_storage_and_config.py` | 6 | Local and R2 storage, path safety, production refuses to start without R2 or a strong secret |
| `test_seed_demo.py` | 14 | The 12 demo products with exact tiers and prices, safe SVG placeholders, idempotent seed, guarded reset |
| `test_health.py` | 4 | Health check with a database ping; security headers on every response |

## Frontend (303)

| File | Tests | What it proves |
|---|---|---|
| `lib/money.test.ts` | 29 | Strict KWD parsing (no floats), formatting with three decimals in both languages, Latin digits |
| `lib/pricing.test.ts` | 28 | Bundle arithmetic, price per pack, best value, savings, bundle-count validation |
| `lib/cart.test.tsx` | 22 | The guest cart: merge rules, 99 cap, persistence, damaged storage, several tabs, merge ids |
| `locales/locales.test.ts` | 5 | English and Arabic have the same keys and placeholders |
| `test/auth.test.tsx` | 14 | Sign in and out, guards, session restore, expired token, Continue as guest, the mobile header menu, registration rejects a badly formed email before any request, show/hide password on both forms, the reviewer credentials box on the sign-in page only |
| `test/i18n.test.tsx` | 12 | Language switch, direction, title, persistence, `Accept-Language`, error translation |
| `test/admin-named.test.tsx` | 13 | Brands and categories screens including the in-use message |
| `test/admin-products.test.tsx` | 13 | Product list, URL filters, debounced search, pagination, delete |
| `test/admin-product-form.test.tsx` | 29 | Create and edit, bilingual fields, tiers with exact fils, image upload and reorder, validation |
| `test/home.test.tsx` | 4 | Home page: store name, tagline and Shop now; the three top bundles by saving per pack and their cards; header links and the demo footer |
| `test/store.test.tsx` | 30 | Listing, bundle chips and prices, the Category and Brand dropdowns (custom list, no counts, keyboard and outside click), search, empty and error states, quick add, Arabic |
| `test/product-page.test.tsx` | 28 | Product page, gallery, live totals (the brief's example), bundle-count validation, add to cart |
| `test/cart-page.test.tsx` | 29 | Cart lines from the server quote, the receipt summary and totals, stepper, remove, Clear cart with confirmation, removed offers flagged, empty, loading and error states, Arabic |
| `test/cart-sync.test.tsx` | 23 | Merge on sign-in exactly once (also under React's double effects), nothing saved before the first fetch, ordered saves, failures, sign-out, a lost merge answer retried safely |
| `test/polish.test.tsx` | 24 | One main landmark and one banner per page, heading order, skip link, focus on navigation, crash screen, favicon and security headers |

## Beyond the automated tests

Checked by hand in Chrome and not part of CI: screenshots of every page at 360px, tablet and desktop in English and Arabic; an axe accessibility audit and a horizontal-overflow check of 14 pages × 3 widths × 2 languages (no findings after the fixes); and an end-to-end run of the guest cart merging into an account against the real API and database.
