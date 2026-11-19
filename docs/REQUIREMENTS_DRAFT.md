# Requirements Draft: Medical E-Commerce with Multi-Tier Pricing

Status: IMPLEMENTED (milestones M0 to M6). Known gaps: C22's "repriced" notice (listed under known limitations in the README), the repository rename (D7, not done yet) and the seed images (B13: one SVG placeholder per product instead of 2 to 3 images). Everything else below is built and tested. IDs: **C** = customer, **A** = admin, **B** = business rule, **N** = non-functional, **D** = decision, **Q** = open question.

Source: the assessment brief plus the decisions agreed in review (see section 8). Items marked *(added)* go beyond the brief on purpose.

---

## 1. Purpose and scope

A small medical e-commerce app. Customers browse a catalog by brand and category and buy **bundles** (pricing tiers). Admins manage products, brands, categories, images and pricing tiers without editing code. Everything persists in a real database.

**In scope:** storefront, product page, cart (hybrid), accounts (sign up, login, roles), admin catalog management, image uploads, deployment.

**Out of scope:** checkout, payment, delivery, orders, inventory deduction, email, password reset, multiple currencies.

## 2. Roles

| Role | Can do |
|---|---|
| **Guest** | Browse storefront, view products, use a local cart, sign up, log in |
| **Customer** | Everything a guest can, plus a server-side cart that follows them across devices |
| **Admin** | Everything a customer can, plus the admin area (catalog management) |

- Roles are enforced **on the server**. The frontend only hides pages.
- One permissions config maps each module (`catalog_admin`, `cart`) to the roles allowed to read and write it. Guards are attached in `main.py`.
- The first admin is seeded from environment variables. Customers can never self-promote.

## 3. Customer requirements

### 3.1 Accounts *(added)*
- **C1** Sign up with name, email and password (minimum 10 characters). Duplicate email is rejected with a clear message.
- **C1a** *(added)* The sign-up form checks that the email is a valid address (for example `name@example.com`) before sending anything, and shows the message next to the field.
- **C1b** *(added)* Every password field (sign in and sign up) has a show/hide control.
- **C2** Log in with email and password. Success returns a JWT (60 minutes). Wrong credentials give one generic error.
- **C3** Log out clears the session and the local cart copy (see B9).
- **C4** The UI shows who is signed in and exposes the admin link only to admins.
- **C5** Disabled accounts are rejected on every request.
- **C5a** *(added)* The sign-in page shows a "Reviewing this store?" box with the demo admin email and password, so a reviewer can open the admin area at once.

### 3.2a Home page *(added)*
- **C5b** `/` is a home page: a hero with the store name, a tagline and a **Shop now** button to `/shop`; a "Top bundles" section with the three products whose best offer saves the most per pack, each linking to its product page; a one-line footer saying it is a demo store.
- **C5c** The header is the same on every page: Shop on the left, the store name in the centre, and Cart (with its count), Sign in or the user's name and Sign out, the admin link (admins only) and the language switch on the right. Below 1024 px wide the right-hand actions fold into a menu, so every action stays reachable on a phone.

### 3.2 Shop (product listing at `/shop`)
- **C6** Show every active product with its main image, name, brand, category and **all** its pricing options (units and bundle price).
- **C7** Show lists of brands and categories. Selecting one filters the products. Brand and category filters combine. *(Built as two dropdowns, Category and Brand, drawn by the app in the site's style rather than the browser's system menu, keyboard accessible, listing names without product counts.)*
- **C8** Show the active filter, a clear-filters control and a result count.
- **C9** Open a product page from any card.
- **C10** Quick add: pick an offer on the card and add one bundle to the cart.
- **C11** Loading, error (with retry) and empty ("no products match") states.
- **C12** Server-side pagination with a stable order.
- **C12a** A search box returns products whose **product name, brand name or category name** matches the text (case-insensitive substring, debounced, server-side). It combines with the brand and category filters. It always matches both the English and the Arabic names, in either view, so a customer can find a product in either language. Results are products, with the matching brand or category shown on the card as usual.

### 3.3 Product details
- **C13** Show name, description, brand, category and an **image gallery** (main image plus thumbnails).
- **C14** Show all pricing options, one per tier. Products with one, two or three tiers must all render correctly, with no fixed tier count in the UI.
- **C15** Select an offer and a bundle count (integer, minimum 1, maximum per B7). The total and the total pack count update immediately.
- **C16** Add the selection to the cart. Show confirmation and the updated cart count.
- **C17** An unknown or inactive product shows a clear "not found" page.

### 3.4 Cart
- **C18** Each line shows the product, the selected offer, bundles, **pack quantity** (for example "2 × 4-pack offer, 8 packs") and the line total.
- **C19** Change a line's bundle count (validated) or remove it. Totals recalculate automatically.
- **C20** Different offers of the same product are **separate lines**. Adding the same product and tier again increases the existing line.
- **C21** Show the grand total, one summary row per line with the number of bundles in the cart, and an empty-cart state with a link back to the store.
- **C21a** *(added)* A **Clear cart** button empties the cart after a confirmation.
- **C22** If a line's offer was deleted or changed by an admin, the cart shows it clearly (unavailable, or repriced) and excludes unavailable lines from the total.
- **C23** Hybrid storage (B9): a guest cart lives in localStorage, and a signed-in cart lives on the server. The guest cart merges into the server cart silently on sign-in, with no notice.

### 3.5 Language (English and Arabic) *(added)*
- **C24** The storefront is available in **English (default)** and **Arabic**. A language switcher is visible on every page, including the login and sign-up pages.
- **C25** Arabic switches the whole customer UI to **right-to-left**: `dir="rtl"`, `lang="ar"`, mirrored layout, icons and spacing. The page title updates.
- **C26** All fixed interface text (buttons, labels, messages, validation errors, empty states, "packs", "bundles" and so on) exists in both languages, in the storefront and in the admin area (A14).
- **C27** Admin-managed content (product name and description, brand name, category name, tier label, image alt text) is shown in Arabic **only if the admin entered an Arabic value**. Otherwise the English value is shown in the Arabic view (B14).
- **C28** The chosen language persists across visits (localStorage). First visit defaults to English.
- **C29** Prices stay in KWD with three decimals in both languages, formatted with `Intl.NumberFormat` (B15).
- **C30** Searching, filtering and the cart work identically in both languages. Switching language never clears the cart or the filters.

## 4. Admin requirements

- **A1** Admin area reachable only by admins. Everyone else gets 403 from the API and a redirect in the UI.
- **A2** **Products:** list (paginated, search by name, filter by brand, category and status), create, edit, delete. Fields: name, description, brand, category, active flag, images.
- **A3** **Brands:** list, create, rename, delete. Deletion is blocked while products are attached (B11).
- **A4** **Categories:** same behavior as brands.
- **A5** **Pricing tiers** per product: add, edit, delete. Fields: label (for example "4 packs"), units per bundle, bundle price (KWD, 3 decimals). The count is dynamic, with no hardcoded maximum.
- **A6** **Images:** upload several images per product, set the main image, reorder, delete. Alt text is required. Allowed types: JPEG, PNG, WebP, up to 5 MB each. The server checks magic bytes and re-encodes.
- **A7** Every form shows field-level validation errors from the server. Saving shows success or failure.
- **A8** Changes appear on the storefront without a code change or redeploy, and survive a refresh.
- **A9** Deleting a product asks for confirmation. Deleting a tier or image does too.
- **A10** Loading, error and empty states on every admin screen.
- **A11** Every admin-managed text field has an **optional Arabic counterpart** next to it: product name and description, brand name, category name, tier label, image alt text. Arabic is never required, and English remains required.
- **A12** The Arabic inputs are right-to-left. Nothing is auto-translated. The admin types the Arabic text, or leaves it empty.
- **A13** Next to each empty Arabic field the form says that the English text will be shown in the Arabic view. The product list marks products missing an Arabic name.
- **A14** The admin area interface (menus, buttons, labels, tables, messages) is available in **English and Arabic**, with the same language switcher, RTL layout and persisted choice as the storefront (C24, C25, C28). The admin interface language and the content fields are independent: **edit forms always show both the English and the Arabic inputs**, whichever interface language is active.
- **A15** Admin lists show names resolved for the active interface language (Arabic if present, else English, per B14). The product list search box matches both languages.

## 5. Business rules

- **B1** A **tier** is an independent offer with `units` (packs per bundle) and `price` (the **total bundle price**, never per pack).
- **B2** A cart line is `(product, tier, bundles)`. Line total = `bundles × tier.price`. Pack quantity = `bundles × tier.units`. Example: 2 × the 4-pack offer at 19.500 = **39.000 KWD** and 8 packs.
- **B3** **The server decides every price.** The client sends only `product_id`, `tier_id` and `bundles`. `POST /cart/quote` returns line totals, pack quantities, the grand total and a `problems` list. It never errors for the customer's choices.
- **B4** Money is stored as **integer fils** (1 KWD = 1000 fils), never floats. It is formatted as KWD with exactly three decimals using `Intl.NumberFormat`.
- **B5** Validation, in Pydantic and in the database (CHECK constraints): `units ≥ 1`, `price > 0`, `bundles` an integer in `1..B7`. A tier belongs to exactly one product. `(product_id, units)` is unique.
- **B6** A product's visible tiers are ordered by `units` ascending.
- **B7** Maximum bundles per line: **99** (Q2).
- **B8** A product with **zero tiers** is not purchasable. It is **visible to admins only**: hidden from the storefront and from public API responses, and flagged in the admin list. An admin cannot activate it until it has at least one tier.
- **B9** **Hybrid cart:**
  - Guest: cart choices only (`product_id`, `tier_id`, `bundles`) in localStorage. Prices always come from a fresh quote.
  - Signed in: the cart lives on the server (`GET/PUT /me/cart`).
  - On sign-in, merge the guest cart into the server cart. A matching `(product, tier)` sums its bundles, capped at B7.
  - Never save to the server before the account's cart has been fetched, or an empty local cart wipes it.
  - On sign-out, clear the local cart and record which account a local cart belongs to.
- **B10** Different tiers of one product are never merged into one line.
- **B11** **Deletion rules:**
  - Brand or category with products attached: blocked with **409** and a message naming the count ("3 products use this brand").
  - Product: deletes its tiers and images (cascade). Carts holding it report the line as unavailable through the quote (C22).
  - Tier: deleted. Carts holding it report the line as unavailable through the quote.
  - Server cart rows reference `product_id` and `tier_id`, and the quote resolves them. Lines whose tier is gone are dropped from the quote and flagged.
- **B12** Inventory is not tracked or deducted.
- **B14** **Optional Arabic translation with English fallback.** Each translatable field has an English value (required) and an Arabic value (optional, nullable). Empty or whitespace-only Arabic is stored as null. The displayed value is `arabic if present else english`, **per field**: a product can have an Arabic name and an English description. Fallback applies to every field type (products, brands, categories, tiers, image alt text).
- **B15** Currency is **KWD, hardcoded**, always three decimals, in both languages. Arabic view shows the currency as `د.ك`, English as `KWD`. Digits stay Latin (0-9) in both languages, including dates, counts and quantities (D19).
- **B16** The language is sent with each storefront API request (`Accept-Language`). **The server resolves the fallback**, so the client never guesses, and search matches both names. Admin endpoints return both language values for editing. Quotes and cart responses are resolved too, so cart lines show the right language.
- **B17** Error responses keep the shape `{error: {code, message, fields}}`. The client translates by `code` and falls back to the English `message` for unknown codes.
- **B13** Seed data must include:
  - at least **2 brands** and **2 categories**,
  - **Product A:** exactly 1 tier (1 pack),
  - **Product B:** exactly 2 tiers (1 pack, 4 packs),
  - **Product C:** exactly 3 tiers (1 pack 5.500, 4 packs 19.500, 12 packs 55.000 KWD),
  - one image each: an SVG placeholder written by the seed, replaced with real pictures in the admin area (originally 2 to 3 images each; see DESIGN.md section 14).
  - Seed data is fictional, with no real company or employer names.

## 6. Non-functional requirements

- **N1** Backend: Python 3.13, FastAPI, SQLAlchemy 2 (async), Pydantic v2, Alembic, PostgreSQL 16. Layering: routers → crud/services → models.
- **N2** Frontend: React 19, TypeScript, Vite, React Router 7, Tailwind v4. No global state library (context plus page hooks).
- **N3** Auth: PyJWT bearer tokens, bcrypt hashing. A global 401 handler on the client.
- **N4** Images: local disk in dev and Cloudflare R2 in production, behind one storage interface. Only the `storage_key` is stored. In production the app refuses to start without R2 configured.
- **N5** One API client, one error shape `{error: {code, message, fields}}`, and types mirroring backend schemas.
- **N6** Responsive from 360px wide to desktop. Mobile-first card grid, with the cart and admin tables usable on a phone.
- **N7** Loading, error and empty states for every data-driven view.
- **N8** Basic accessibility: semantic HTML, labelled inputs, alt text, visible focus, sufficient contrast. No full audit.
- **N9** Tests on a real Postgres. The cart math, deletion rules, auth and role guards, and the guest-to-server cart merge are mandatory. Frontend tests cover the cart and the price display.
- **N10** CI (GitHub Actions): ruff, migration up/down/up plus `alembic check`, pytest, oxlint, vitest and a build.
- **N11** Deployment: Railway (API and Postgres), Vercel (SPA) and Cloudflare R2 (images). Deploy at M0. Config only through env vars.
- **N12** Rate limiting on login and sign-up.
- **N13** Security: secrets only in env, `.env` git-ignored, CORS limited to the frontend origin, uploads validated, `Cache-Control: no-store` on user data.
- **N14** i18n: `react-i18next` with one JSON file per language (English, Arabic), keys shared and checked by a test that fails if a key exists in one file but not the other. RTL uses Tailwind logical utilities (`ms-`, `me-`, `ps-`, `pe-`, `text-start`) instead of left/right. Arabic uses a font that supports Arabic script. Tests cover the fallback rule and the direction switch.
- **N15** Local environment is self-contained, with **nothing installed globally** on the developer machine:
  - Python packages only in `backend/.venv` (`python3 -m venv`, `pip` run from the venv, never `pip install` outside it, no `sudo`, no Homebrew installs).
  - Node packages only in `frontend/node_modules` (`npm ci` / `npm install`, never `-g`; one-off tools through `npx` or as project devDependencies).
  - PostgreSQL only as a Docker container with a named volume (`docker compose up -d db`), removable with `docker compose down -v`. No local Postgres or `psql`.
  - Pre-existing tools used as-is: Python 3.13, Node, Docker. If one is missing the setup stops and says so; it never installs it.
  - `.venv`, `node_modules` and the DB volume are git-ignored. The README documents setup and full cleanup (delete `.venv`, `node_modules`, run `docker compose down -v`).


## 7. Deliverables

1. Live storefront URL, with the admin area reachable. The demo admin email and password are shown on the sign-in page; the demo customer password is sent with the submission. The README holds no credentials.
2. GitHub repository (renamed to a neutral name), one monorepo.
3. README: setup, project structure, environment variable table, deploy guide.
4. List of AI tools and technologies used.
5. Known limitations. Expected entries: no checkout or orders, no password reset or email verification, single admin seeded from env, JWT expiry with no refresh tokens, per-process rate limiting.
6. Short DESIGN.md (data model, API, rules) and TESTS.md.

## 8. Decisions recorded

| ID | Decision |
|---|---|
| D1 | Build auth (sign up, login, JWT, roles) even though the brief excludes it |
| D2 | Hybrid cart: localStorage for guests, server-side for signed-in users, merged on sign-in |
| D3 | Implement the quote endpoint |
| D4 | Block brand and category deletion while products are attached, with a clear message |
| D5 | Railway plus Vercel hosting |
| D6 | Follow the playbook versions: Python 3.13, React 19 |
| D7 | Rename the repository to a neutral name |
| D8 | Real image uploads: local disk in dev, R2 in production |
| D9 | Image gallery per product |
| D10 | No password reset (listed as a known limitation) |
| D11 | Maximum 99 bundles per cart line |
| D12 | Single admin seeded from env, no user management screen |
| D13 | Products with no tiers are visible to admins only |
| D14 | Guest cart merges into the server cart silently |
| D15 | Currency hardcoded to KWD |
| D16 | Storefront search box by product name |
| D17 | English default plus Arabic (RTL). Admin content is never auto-translated. Arabic is optional per field, with English fallback |
| D18 | The admin area interface is also available in English and Arabic |
| D19 | Digits stay Latin in the Arabic view |
| D20 | Language choice is stored in the browser only, not on the account |
| D21 | Search matches product, brand or category name, in both languages |
| D22 | The `design-taste-frontend` skill was tried on a separate branch for the storefront look and **dropped**: the result was not kept. The interface was designed with the `frontend-design` skill instead: white and teal, IBM Plex Sans and Plex Sans Arabic for text, Fraunces for the store name. Where any design choice conflicts with these requirements (RTL, product cards, uploaded images), the requirements win. |

## 9. Open questions

None at the moment. Everything above is settled and ready for DESIGN.md.

## 10. Proposed milestones

| # | Milestone | Done means |
|---|---|---|
| M0 | Monorepo, compose, CI, Alembic, health check, **first deploy** | Live API reaches the database |
| M1 | Auth: sign up, login, me, roles, guards, admin seed | Admin and customer can log in on the live URL |
| M2 | Catalog API and seed: brands, categories, products, tiers, images, storage | Everything works via `/docs`, with tests |
| M3 | i18n and RTL foundation (switcher, language files, key-parity test), then the admin UI with the optional Arabic fields | Edits persist and show on refresh, admin works in both languages |
| M4 | Storefront: listing, filters, search, product page | Customer browses in both languages, correct prices, fallback works |
| M5 | Cart: local, quote, server sync, merge | The 2 × 4-pack = 39.000 test passes |
| M6 | Polish, responsive pass, README, limitations, final live check | All deliverables ready |

Each milestone ends with tests, a deploy and a manual check on the live URL.
