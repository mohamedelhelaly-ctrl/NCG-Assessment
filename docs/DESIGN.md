# Design: Medical E-Commerce with Multi-Tier Pricing

Status: implemented. Implements [REQUIREMENTS_DRAFT.md](REQUIREMENTS_DRAFT.md) (IDs in brackets point there). Conventions follow [../setup/ARCHITECTURE_OVERVIEW.md](../setup/ARCHITECTURE_OVERVIEW.md) and [../setup/PLAYBOOK.md](../setup/PLAYBOOK.md). The reasons behind the main choices are in [DECISIONS.md](DECISIONS.md).

---

## 1. System overview

```
Browser (React 19 SPA, Vercel)
   │  REST + Bearer JWT, Accept-Language: en|ar
   ▼
FastAPI (Railway) ──▶ PostgreSQL 16 (Railway)
   │
   └──▶ Image storage: local disk (dev) | Cloudflare R2 (prod)
```

| Unit | Stack |
|---|---|
| Backend | Python 3.13, FastAPI, SQLAlchemy 2 (async, asyncpg), Pydantic v2, Alembic, PyJWT, bcrypt, slowapi, Pillow, boto3 |
| Frontend | React 19, TypeScript, Vite, React Router 7, Tailwind v4, react-i18next |
| Tests | pytest on real Postgres; Vitest + Testing Library |
| Local env | `backend/.venv`, `frontend/node_modules`, Postgres in Docker only [N15] |

## 2. Repository layout

```
project/
├── docker-compose.yml            # db (+ backend, frontend for full-stack local runs)
├── .env.example
├── .github/workflows/ci.yml
├── README.md
├── docs/                         # REQUIREMENTS_DRAFT, DESIGN, DECISIONS, TESTS, UAT
├── backend/
│   ├── Dockerfile  docker-entrypoint.sh  railway.json
│   ├── requirements.txt  requirements-dev.txt  pyproject.toml  .env.example
│   ├── alembic/versions/
│   ├── app/
│   │   ├── main.py  config.py  database.py  deps.py
│   │   ├── core/        # security, permissions, errors, rate_limit, i18n
│   │   ├── models/      # user, brand, category, product, product_image, pricing_tier, cart
│   │   ├── schemas/     # mirrors models; public (resolved language) and admin (both languages) variants
│   │   ├── crud/        # one class per entity
│   │   ├── routers/     # auth, brands, categories, products, cart, admin_brands, admin_categories,
│   │   │                # admin_products, admin_tiers, admin_images
│   │   └── services/    # quote, cart (merge), images, product_admin, catalog_view, storage/ (base, local, r2)
│   ├── scripts/         # seed_admin, seed_demo
│   └── tests/
└── frontend/
    ├── vercel.json  .env.example
    └── src/
        ├── App.tsx      # all routes and guards
        ├── lib/         # api, auth, cart, errors, i18n, money, pricing, tiers, types
        ├── hooks/       # useApi, useDebounce, usePageTitle, useQuote
        ├── locales/     # en.json, ar.json
        ├── components/  # auth/, layout/, ui/, store/, admin/
        └── pages/       # HomePage, StorePage, ProductPage, CartPage, LoginPage, RegisterPage, NotFoundPage;
                         # admin/ (ProductsPage, ProductFormPage, BrandsPage, CategoriesPage, NamedPage)
```

Layering: **routers → crud/services → models**. Routers hold no queries or business rules. Services know nothing about HTTP.

## 3. Data model

```
users 1───1 carts 1───* cart_items            (cart_items.tier_id is NOT a foreign key, see 3.2)
brands 1───* products *───1 categories
products 1───* pricing_tiers
products 1───* product_images
```

All tables: integer `id` primary key, `created_at`, `updated_at` (timezone-aware, server defaults). Every foreign key has an explicit `ondelete` and an index.

### 3.1 Tables

**users**: `email` (unique, stored lowercase), `password_hash`, `full_name`, `role` (`customer` | `admin`, default `customer`), `is_active` (default true).

**brands**: `name` (required, unique case-insensitive), `name_ar` (nullable).
**categories**: same shape as brands.

**products**
| Column | Notes |
|---|---|
| `brand_id` | FK brands, `ON DELETE RESTRICT`, not null |
| `category_id` | FK categories, `ON DELETE RESTRICT`, not null |
| `name`, `name_ar` | `name` required, `name_ar` nullable |
| `description`, `description_ar` | `description` required (may be short), `description_ar` nullable |
| `is_active` | default false |

**pricing_tiers**
| Column | Notes |
|---|---|
| `product_id` | FK products, `ON DELETE CASCADE` |
| `label`, `label_ar` | for example "4 packs" / Arabic text. `label` required, `label_ar` nullable |
| `units` | integer, `CHECK (units >= 1)` |
| `price_fils` | bigint, `CHECK (price_fils > 0)` and `CHECK (price_fils <= 1000000000)`. The **total bundle price** in fils [B1, B4, B5] |
| unique `(product_id, units)` | no duplicate bundle sizes [B5] |

**product_images**: `product_id` (FK, `ON DELETE CASCADE`), `storage_key`, `alt` (required), `alt_ar` (nullable), `position` (int). The main image is the lowest `position` (ties by `id`), so "set main" is a reorder and no extra column is needed.

**carts**: `user_id` (FK users, `ON DELETE CASCADE`, unique), `last_merge_id` (nullable: the id of the last guest cart merged in, so a retried merge is recognised). Created lazily.

**cart_items**: `cart_id` (FK carts, `ON DELETE CASCADE`), `product_id` (int), `tier_id` (int), `bundles` (`CHECK (bundles BETWEEN 1 AND 99)`), unique `(cart_id, tier_id)` [B7, B10].

### 3.2 Why `cart_items` has no foreign keys to products and tiers
If it had `ON DELETE CASCADE`, a deleted tier would make the line vanish silently. If it had `SET NULL`, the line would be orphaned with no way to match it. Requirement [B11, C22] says the cart must report the line as **unavailable**. So the ids are plain integers, and the quote resolves them and flags what no longer exists. Cleanup is the customer's: they remove the line.

### 3.3 Money
- Stored and transported as **integer fils** (1 KWD = 1000 fils). No floats anywhere.
- Admin forms accept text like `19.500` and convert with a strict parser (`^\d+(\.\d{1,3})?$`, string split, no `parseFloat`). The API accepts and returns integers only.
- Display: `Intl.NumberFormat` with currency `KWD`, always 3 fraction digits. Locale `en` and `ar-u-nu-latn` (Arabic text, **Latin digits** [D19]). Arabic shows `د.ك`, English `KWD`.
- Maximum line total is 99 × 1,000,000,000 fils, far below 2^53, so JS numbers are safe.

### 3.4 Visibility rule (used by every public query)
A product is **publicly visible** when `is_active = true` **and** it has at least one tier [B8]. Everything else is admin-only. One reusable SQL expression in `crud/product.py` is used by the list, the detail, the counts and the quote.

### 3.5 Migrations
Alembic, linear history, one small revision per change, committed with the model change. CI runs `upgrade head → downgrade base → upgrade head → alembic check`.

## 4. Language handling [C24-C30, B14-B17]

- The client sends `Accept-Language: ar` or `en` on every request. The server reads only the primary tag: `ar*` gives Arabic, anything else English.
- `core/i18n.pick(lang, en, ar)` returns `ar` if it is non-empty after trimming and `lang == "ar"`, else `en`. It is applied **per field**.
- **Public and storefront-facing responses are resolved** by the server: `name`, `description`, `label`, `alt` already hold the right text. Responses set `Vary: Accept-Language`.
- **Admin responses return both** values (`name`, `name_ar`, and so on) and also the resolved `display_name` for lists [A15].
- Writes: whitespace-only Arabic is stored as `NULL`.
- Search always matches both languages (see 6.2).
- Fixed UI text lives in `frontend/src/locales/{en,ar}.json`. A test fails if the key sets differ. Server error `code`s map to client keys, with the English `message` as the fallback [B17].
- The frontend language context sets `<html lang dir>`, persists to localStorage (`lang`), and the API client reads it for the header. Layout uses Tailwind logical utilities (`ms-`, `pe-`, `text-start`) [N14].

## 5. Auth and permissions [C1-C5, A1, N3, N12]

- `POST /auth/register` always creates a `customer`. Password minimum 10 characters. Email normalized to lowercase, duplicates return 409 `email_taken`.
- `POST /auth/login` returns `{access_token, token_type, user}`. JWT HS256, 60 minutes, claims `sub`, `exp`. Wrong email or password returns one generic 401 `invalid_credentials`.
- `deps.get_current_user` decodes the token, loads the user from the database on every request, and rejects missing or `is_active = false` users with 401. **The role is read from the database, not the token**, so a role change takes effect immediately.
- `core/permissions.py` holds one config:

```python
PERMISSIONS = {
    "catalog_admin": {"read": ["admin"], "write": ["admin"]},
    "cart":          {"read": ["customer", "admin"], "write": ["customer", "admin"]},
}
```
  `require_module("catalog_admin", "write")` builds the guard. Guards are attached when routers are registered in `main.py`, so access control is visible in one place. Wrong role returns 403.
- Public routes (catalog reads, `/cart/quote`) have no guard.
- `scripts/seed_admin.py` creates the first admin from `FIRST_ADMIN_EMAIL` / `FIRST_ADMIN_PASSWORD`. It is idempotent and runs in the entrypoint. There is no promotion endpoint [D12].
- Rate limits (slowapi): login 10/min per IP, register 5/min per IP. The limiter is per process.
- Frontend: token in memory plus localStorage, a global 401 handler clears the session and redirects to login. Guards `RequireAuth`, `RequireAdmin`, `GuestOnly` in `App.tsx` only hide pages.

## 6. API

Base path `/api/v1`. JSON. Errors always use `{"error": {"code", "message", "fields", "params"}}`. `fields` maps field names to messages for validation errors. `params` is an optional object for message interpolation (for example `{"count": 3}`); this extends the shape in [B17] and is backwards compatible.

### 6.1 Endpoints

| Method and path | Auth | Purpose |
|---|---|---|
| `POST /auth/register` | none | Create a customer |
| `POST /auth/login` | none | Get a token |
| `GET /auth/me` | any user | Current user |
| `GET /brands` | none | Brands with `product_count` of visible products |
| `GET /categories` | none | Categories, same shape |
| `GET /products` | none | Paginated visible products with all tiers and the main image |
| `GET /products/{id}` | none | One visible product with gallery and all tiers, else 404 |
| `POST /cart/quote` | none | Price a list of lines (6.3) |
| `GET /me/cart` | cart | The signed-in user's cart lines |
| `PUT /me/cart` | cart | Replace the cart's lines |
| `POST /me/cart/merge` | cart | Merge guest lines into the server cart (6.4) |
| `GET/POST /admin/brands`, `PUT/DELETE /admin/brands/{id}` | admin | Brand CRUD |
| `GET/POST /admin/categories`, `PUT/DELETE /admin/categories/{id}` | admin | Category CRUD |
| `GET /admin/products` | admin | Paginated list incl. inactive and tier-less, with flags |
| `POST /admin/products` | admin | Create (optionally with nested `tiers`) |
| `GET/PUT/DELETE /admin/products/{id}` | admin | Read (both languages), update, delete |
| `POST /admin/products/{id}/tiers` | admin | Add a tier |
| `PUT/DELETE /admin/tiers/{id}` | admin | Edit, delete a tier |
| `POST /admin/products/{id}/images` | admin | Upload one image (multipart: `file`, `alt`, `alt_ar`) |
| `PUT /admin/images/{id}` | admin | Edit alt text |
| `PUT /admin/products/{id}/images/order` | admin | Reorder (list of image ids; first is main) |
| `DELETE /admin/images/{id}` | admin | Delete an image |
| `GET /healthz` | none | Liveness plus a DB ping |

### 6.2 Listing and search [C6-C12a]
`GET /products?search=&brand_id=&category_id=&page=1&page_size=12`
- `page_size` default 12, maximum 48. Envelope: `{items, total, page, page_size, total_pages}`.
- Filters combine with AND. `search` is a case-insensitive substring across **product `name`, `name_ar`, brand `name`, `name_ar`, category `name`, `name_ar`** (any one matches). `%` and `_` in the term are escaped. Search, filtering and sorting run in SQL.
- Stable order: `created_at DESC, id DESC`. A separate count query uses the same filters. Tiers and images are loaded with `selectinload` (no N+1).
- Each item: `id, name, description, brand {id,name}, category {id,name}, main_image {url, alt}, tiers [{id, label, units, price_fils}]` (tiers ordered by `units`).
- `GET /brands` and `GET /categories` sort by the resolved name for the active language. No trigram index at this data size.

### 6.3 Quote [C18-C22, B2, B3]
`POST /cart/quote`
```json
{"lines": [{"product_id": 3, "tier_id": 9, "bundles": 2}]}
```
At most 100 lines. Response:
```json
{
  "lines": [{
    "product_id": 3, "tier_id": 9, "bundles": 2,
    "status": "ok",
    "product_name": "…", "tier_label": "4 packs", "image_url": "…",
    "units": 4, "bundle_price_fils": 19500,
    "pack_quantity": 8, "line_total_fils": 39000
  }],
  "totals": {"line_count": 1, "pack_count": 8, "total_fils": 39000},
  "problems": []
}
```
Rules:
1. Look up each tier with its product in one query, restricted to **publicly visible** products (3.4).
2. `line_total_fils = bundles × price_fils` and `pack_quantity = bundles × units`. Never multiplied by anything else.
3. `status` is `ok`, `unavailable` (tier or product missing, product not visible, or the tier does not belong to the product), or `invalid` (`bundles` not in 1..99). Non-`ok` lines carry null price and name fields and **are excluded from totals**.
4. Each non-`ok` line adds `{"code": "unavailable" | "invalid_bundles", "index": <line index>}` to `problems`.
5. The endpoint never returns an error for customers' choices. Only malformed JSON (a non-integer id, missing field) returns 422.
6. Names, labels and alt text are resolved for the request language.
7. The client never sends or stores prices. Totals always reflect the current prices.

### 6.4 Cart persistence and merge [C23, B9]
- Lines are `{product_id, tier_id, bundles}`, unique by `tier_id`. `PUT /me/cart` replaces all lines in one transaction (the cart row is locked with `FOR UPDATE`). It validates `bundles` 1..99, rejects duplicate `tier_id` and more than 100 lines. It does **not** check that ids exist, so stale lines survive a round trip and show as unavailable.
- `POST /me/cart/merge` takes the guest lines and an optional `merge_id`, and in one transaction sums `bundles` for a matching `tier_id`, caps at 99, and inserts the rest. It returns the merged cart. **With a `merge_id` it is idempotent:** if `carts.last_merge_id` already equals it (the browser never heard the answer and retried), the cart is returned unchanged. The browser stores a fresh id with the guest cart on every change, so an id always stands for exactly those lines. Without an id it is not idempotent.
- `GET /me/cart` returns lines only. The client then calls `/cart/quote` for display, the same path as for guests.

#### Client cart flow (`lib/cart.tsx`)
```
guest                      localStorage "cart:v1" = {owner: null, lines}
login / register  ──▶ 1. store token, fetch GET /me/cart          (state: loading, saving disabled)
                      2. if local lines exist and owner is null:  POST /me/cart/merge → server cart
                      3. clear local lines, set state ready
signed in                  server is the source of truth; edits update state at once, then a
                           debounced PUT /me/cart. A failed PUT shows an error and refetches.
sign-out / 401             clear local cart and token; cart returns to empty guest cart
page load with token       GET /auth/me, then GET /me/cart; no PUT before it completes
```
- **Never PUT before the first GET has finished**, or an empty local cart would wipe the account's cart.
- If localStorage holds lines whose `owner` is another account's id (left behind by a failed sign-out), they are discarded.
- The display always uses `/cart/quote` with the current lines (debounced), so there is one pricing path.

## 7. Images [A6, N4]

- `services/storage/` defines `StorageBackend` with `save(key, bytes, content_type)`, `delete(key)`, `url(key)`. `LocalStorage` writes to `backend/uploads` and the API serves it at `/media`. `R2Storage` uses boto3 against the S3 API and builds URLs from `R2_PUBLIC_URL`. Only `storage_key` is stored.
- Upload pipeline (`services/images.py`): enforce 5 MB, check magic bytes (JPEG, PNG, WebP), open and verify with Pillow, strip EXIF, scale the longest side down to 1600 px, **re-encode as WebP**, save under `products/{product_id}/{uuid}.webp`. At most 10 images per product. `alt` is required.
- Deleting an image or product removes the rows in the transaction and the stored objects **after commit**, best effort.
- In production the app refuses to start without R2 configuration.
- **Seed images** are plain SVG placeholders written by `seed_demo` (the product name on a coloured background), saved through the same storage interface and replaced by real pictures in the admin area. Uploads by the manager still accept only JPEG, PNG and WebP, so SVG cannot be uploaded through the API; the seed writes its own trusted SVG directly.

## 8. Business rules in code

| Rule | Where |
|---|---|
| Bundle math, status per line [B2, B3] | `services/quote.py`, unit tested |
| Visibility [B8] | `crud/product.py` shared expression |
| Brand/category in use returns 409 `brand_in_use` / `category_in_use` with `params.count` (all products, including inactive) [B11] | `routers/admin_brands.py`, `admin_categories.py` through `crud` |
| `is_active = true` requires at least one tier, else 409 `product_needs_tier` [B8] | product create/update service |
| Deleting the **last tier of an active product sets it inactive** in the same transaction, so state stays consistent | tier delete service |
| Product delete cascades tiers and images; carts report unavailable [B11] | model FKs, quote |
| Tier validation: units ≥ 1, price > 0, unique units per product [B5] | Pydantic schema and DB constraints |
| Cart validation: bundles 1..99, unique tier, max 100 lines [B7, B10] | cart schema and DB constraints |
| Language fallback per field [B14] | `core/i18n.pick` |

## 9. Seed data [B13]

`scripts/seed_demo.py` is idempotent and runs when `SEED_DEMO=true`. All data is fictional. The marker for "already seeded" is the brand "Nuvexa Medical".

| Item | Content |
|---|---|
| Brands | Nuvexa Medical, Orvanta Health, Velmora Care, Medquora |
| Categories | Medical Consumables, Medical Devices, First Aid & Wound Care |
| Products | 12, all active: 4 with one tier, 4 with two, 4 with three (for example Nitrile Examination Gloves: 1 pack 5.500, 4 packs 19.500, 12 packs 55.000 KWD) |
| Arabic | none: the manager adds Arabic names, descriptions and labels in the admin area; until then the English text is shown in the Arabic view |
| Images | one SVG placeholder per product (name centred on a plain background, tinted by category), stored through the normal storage backend as `products/{id}/placeholder.svg` |
| Accounts | Admin from env, plus one demo customer (`DEMO_PASSWORD`). The admin email and password are shown on the sign-in page; the customer password is sent with the submission. The README holds no credentials |

**Reset.** `--reset` or `SEED_DEMO_RESET=true` deletes every product, tier, image row, brand and category (and the stored files, best effort) and then seeds. It is skipped when the marker brand already exists, so it can only replace a catalog that is not the demo one, and cannot wipe a seeded catalog on every restart.

## 10. Frontend structure

- **Routes** (all in `App.tsx`): `/` home page (hero, top bundles), `/shop` the product listing with search and filters, `/products/:id`, `/cart`, `/login`, `/register`, `/admin` (redirects to `/admin/products`), `/admin/products`, `/admin/products/new`, `/admin/products/:id`, `/admin/brands`, `/admin/categories`, and a not-found route.
- **API client** (`lib/api.ts`): typed `get/post/put/delete`, base URL from `VITE_API_URL`, token and `Accept-Language` injected, one `ApiError` type, a global 401 handler. Types in `lib/types.ts` mirror the backend schemas.
- **State**: context only (auth, cart, language) plus page hooks. No global state library.
- **List pages**: search is debounced and stale requests are cancelled. Filters live in the URL query string, so a filtered page can be reloaded and shared.
- **Product page**: selecting a tier and a bundle count shows the line total and the pack count immediately, computed from the tier data already loaded (the same formula as the server); the server quote remains the source of truth in the cart.
- **Admin forms**: English and Arabic inputs shown side by side, Arabic inputs set to `dir="rtl"`, a hint under each empty Arabic field [A11-A13]. Tier editor edits rows inline with a per-row save. Price inputs use the strict KWD parser.
- **States**: every data view has loading, error with retry, and empty states [N7].
- **Styling**: Tailwind v4 theme tokens as CSS custom properties. White with teal `#069494` for accents and darker teals `#057a7a` / `#045f5f` for filled buttons and small text, so contrast passes AA. IBM Plex Sans and IBM Plex Sans Arabic for text; Fraunces bold for the store name only. Designed with the `frontend-design` skill (D22).
- **Header**: Shop on the left, the store name in the centre, Cart with its count, Sign in or the user's name and Sign out, Manage Store (admins) and the language switch on the right. Below 1024 px the right-hand actions fold into a menu panel that closes on Escape, an outside click or navigation.
- **Added while styling** [C1a, C1b, C5a, C5b, C21a]: a home page with the three top bundles (biggest saving per pack, `topBundles` in `lib/pricing.ts`); Category and Brand filters as a custom dropdown (`components/ui/Dropdown.tsx`, a keyboard-accessible listbox, names without counts); a show/hide control on password fields (`components/auth/FormField.tsx`); an email format check on sign-up before any request; a demo credentials box on the sign-in page; a receipt-style cart summary and a Clear cart button with a confirmation; arrows on the product gallery.

## 11. Testing plan (detail goes in TESTS.md)

Backend (real Postgres, separate `*_test` database):
- **Quote**: 2 × 4-pack at 19.500 gives 39.000 and 8 packs; same product with two tiers gives two lines; deleted tier, inactive product, tier-less product and mismatched tier/product give `unavailable` and are excluded from totals; `bundles` 0 and 100 give `invalid`.
- **Catalog**: filters combine; search hits product, brand and category names in both languages; pagination envelope and stable order; visibility rule.
- **Admin**: CRUD for each entity; 409 on brand/category in use with the count; `product_needs_tier`; last-tier delete deactivates; tier constraints (units, price, duplicate units).
- **Auth**: register, duplicate email, login, wrong password, disabled user, role guards (customer gets 403, guest gets 401), role read from the database.
- **Cart**: PUT validation, merge sums and caps at 99, merge with unknown ids, concurrent PUTs.
- **Images**: type, size and magic-byte rejection, re-encode, reorder sets main, storage failure.
- **i18n**: fallback per field, whitespace-only Arabic stored as null, `Vary` header.

Frontend (Vitest, Testing Library, query by role and name):
- Money formatting in both languages (Latin digits, `د.ك`) and the KWD parser edge cases.
- Cart reducer and the guest-to-server merge flow (no PUT before the first GET).
- Locale key parity between `en.json` and `ar.json`; `dir` and `lang` switch.

CI: ruff, migration up/down/up and `alembic check`, pytest, oxlint with `--deny-warnings`, vitest, `tsc -b && vite build`.

## 12. Configuration (environment variables)

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | backend | rewritten to asyncpg and psycopg forms in `database.py` |
| `ENV` | backend | `development` or `production`; production requires R2 and a real `JWT_SECRET` |
| `JWT_SECRET` | backend | required |
| `FRONTEND_URL`, `CORS_ORIGINS`, `CORS_ORIGIN_REGEX` | backend | CORS limited to the frontend origin |
| `FIRST_ADMIN_EMAIL`, `FIRST_ADMIN_PASSWORD` | backend | admin seed |
| `SEED_DEMO`, `DEMO_PASSWORD` | backend | optional demo data and customer |
| `STORAGE_BACKEND` | backend | `local` or `r2` |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | backend | R2 only |
| `PUBLIC_API_URL` | backend | used to build local media URLs |
| `VITE_API_URL` | frontend | baked in at build time, no trailing slash |

## 13. Deployment

Same as the playbook, scaled down: Railway for the API and Postgres (root directory `backend`, health check `/healthz`, entrypoint runs `alembic upgrade head`, seeds the admin and the optional demo data, then starts uvicorn with `--proxy-headers`), Vercel for the SPA (`vercel.json` with the SPA rewrite and cache headers), Cloudflare R2 for images. **Deploy at M0**, then after each milestone. Take a `pg_dump` before a release that includes a migration.

## 14. Clarifications and deviations from the requirements

1. **C22 "repriced" notice:** the quote always uses current prices, so a price changed by an admin is applied automatically, but the cart does **not** show a "price changed" notice. Showing one would require storing the last-seen price per line. **Accepted by the owner:** it is left out and listed under known limitations. The "unavailable" case is fully handled.
2. **`cart_items` has no foreign keys** to products and tiers (3.2), which departs from the playbook's "explicit `ondelete` on every foreign key" for those two columns, on purpose.
3. **Error shape** gains an optional `params` object (section 6).
4. **Deleting the last tier of an active product** deactivates the product (section 8), which the requirements did not specify.
5. **Seed images are SVG placeholders**, not photographs (section 7).
6. **Fonts:** IBM Plex Sans and IBM Plex Sans Arabic for all text (the Arabic family supports Arabic script and reads well at small sizes), and Fraunces bold for the store name only.

## 15. Decisions made while building

- **Idempotent merge:** `POST /me/cart/merge` accepts a `merge_id` (see 6.4); added after the first version so a lost answer cannot double a guest cart.
- **Seed images are SVG placeholders** the manager replaces; uploads through the API still accept only JPEG, PNG and WebP.
- **The shared "visible product" expression** aliases the tier table inside its `EXISTS`, so the same definition of "visible" works in every query, including the quote.
- **Cart page shows nothing until every line is priced**, to avoid a half-empty summary flashing while the first prices arrive.
- **The admin area is code-split** (lazy routes): customers never download it.
- **Responsive and accessibility audit:** 14 pages × 3 widths × 2 languages in Chrome with axe; one `<main>` per page via the layout, a skip link, focus moved to the content on navigation, and a header whose actions fold into a menu below 1024 px so nothing overflows or becomes unreachable at 360px.
- **Basic security headers** on every API response and on the static site.
- **Known limitation accepted:** no "price changed" notice in the cart (C22); a removed offer is flagged.
