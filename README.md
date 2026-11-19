# MedicStore: medical e-commerce with multi-tier pricing

A storefront and an admin area for a small medical-supplies catalog. Every product can be sold in several **offers** (pricing tiers): a number of packs sold together for one total price. Customers pick an offer and how many bundles they want, and the server prices the cart. The interface is available in **English (default) and Arabic (right to left)**.

- **Live site:** https://ncg-assessment-liard.vercel.app
- **API:** https://ncg-assessment-production.up.railway.app/docs
- **Admin area:** `/admin` on the live site, labelled **Manage Store** in the header once you are signed in as an admin
- **Demo access:** the sign-in page shows the demo admin email and password in a "Reviewing this store?" box, so a reviewer can open Manage Store at once. They are public on purpose; see the known limitations. The demo customer password is supplied with the submission.

See [docs/](docs/) for the [requirements](docs/REQUIREMENTS_DRAFT.md), the [design](docs/DESIGN.md), the [decisions log](docs/DECISIONS.md), the [tests overview](docs/TESTS.md) and the [acceptance test checklist](docs/UAT.md).

## What it does

**Customers (no account needed to browse and shop)**
- Home page with a hero and the three top bundles (the best saving per pack), leading to the shop at `/shop`.
- Browse products with their images, brand, category and **all** pricing options; filter with the Category and Brand dropdowns (a styled, keyboard-friendly list); search by product, brand or category name in either language. Filters live in the address, so a filtered view can be shared.
- Product page: image gallery (arrows and thumbnails when a product has several pictures), choose an offer and a bundle count (1 to 99), see the total and total packs update.
- Cart: separate lines per offer, change counts, remove, see line totals and a cart total priced by the server (shown as a receipt), and a Clear cart button that asks first. A guest cart is kept in the browser; sign in and it moves to the account and merges with the account's cart.
- Accounts: sign up (the email must be a valid address), sign in, a show/hide control on every password field, roles (customer, admin).
- Works on a phone: below 1024 px the header actions fold into a menu, so Manage Store, Sign in/out and the language stay reachable.

**Store manager (admin area)**
- Create, edit and delete products, brands and categories. Add, edit and delete pricing tiers (packs per bundle and the bundle price) with no fixed number of tiers.
- Upload, reorder, edit and delete product images. Add an optional Arabic version of every text; the English text is shown wherever the Arabic is empty.
- Everything is saved in PostgreSQL and appears on the storefront straight away.

## The pricing logic

| Term | Meaning |
|---|---|
| **Pack** | One unit of the product. Stock is not tracked. |
| **Offer** (pricing tier) | A way to buy: some packs sold together for **one total price**, for example "4 packs at 19.500 KWD". A product has 1, 2, 3 or more offers. |
| **Bundle** | One purchase of an offer. "2 bundles of the 4-pack offer" means the offer was bought twice. |

- **Line total** = bundles × the offer's price (the bundle price is the *total*, never a per-pack price).
- **Packs received** = bundles × packs in the offer.
- Example from the brief: 2 bundles of the 4-pack offer at 19.500 KWD is **39.000 KWD and 8 packs**.
- Money is stored as integer **fils** (1 KWD = 1000 fils) and shown with three decimals (`KWD 19.500`, `19.500 د.ك.`). No floating point anywhere.
- The **server decides every price**: the browser sends only product, offer and bundle count, and `POST /api/v1/cart/quote` returns the prices. A line whose offer was removed is flagged and left out of the total.

## Tech stack

| Part | Technology |
|---|---|
| Backend | Python 3.13, FastAPI, SQLAlchemy 2 (async), Pydantic v2, Alembic, PostgreSQL 16, PyJWT, bcrypt, slowapi, Pillow, boto3 |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, React Router 7, react-i18next, IBM Plex Sans and Plex Sans Arabic |
| Images | Local disk in development, Cloudflare R2 in production |
| Tests | pytest on a real PostgreSQL; Vitest and Testing Library |
| CI | GitHub Actions: lint, migrations up/down/up, tests, build |
| Hosting | Railway (API and database), Vercel (frontend), Cloudflare R2 (images) |

## Project structure

```
backend/
  app/
    main.py            app setup, CORS, security headers, router registration
    config.py          settings from environment variables, startup safety checks
    database.py        engine, session, base model
    deps.py            current-user dependency
    core/              errors, i18n, permissions, rate limit, security
    models/            one module per table
    schemas/           request and response models (the API contract)
    crud/              queries
    routers/           HTTP endpoints, one module per area (public, admin, auth, cart)
    services/          business rules: product admin, quote, cart merge, images, storage backends
  alembic/versions/    migrations (linear history)
  scripts/             seed_admin, seed_demo
  tests/
frontend/
  src/
    App.tsx            every route and guard
    lib/               API client, auth, cart, i18n, money, pricing, types
    hooks/             data loading, debounce, page title, quote
    components/        layout, auth, store, cart, admin, ui
    pages/             storefront, cart, auth and admin/ pages
    locales/           en.json and ar.json (a test keeps them in step)
docs/                  REQUIREMENTS_DRAFT.md, DESIGN.md, DECISIONS.md, TESTS.md, UAT.md
docker-compose.yml     PostgreSQL (and the API image) for local use
```

## Run it locally

Nothing is installed globally: Python packages live in `backend/.venv`, Node packages in `frontend/node_modules`, and PostgreSQL runs in Docker. Docker Desktop must be running.

```bash
cp .env.example .env
cp backend/.env.example backend/.env       # set JWT_SECRET, FIRST_ADMIN_*, DEMO_PASSWORD
cp frontend/.env.example frontend/.env

docker compose up -d db                    # PostgreSQL on localhost:5433

cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/alembic upgrade head
.venv/bin/python -m scripts.seed_admin     # the first admin, from the environment
.venv/bin/python -m scripts.seed_demo      # the demo catalog (at startup it needs SEED_DEMO=true)
.venv/bin/uvicorn app.main:app --reload    # http://localhost:8000/docs

cd ../frontend
npm ci
npm run dev                                # http://localhost:5173
```

### Tests and checks

```bash
cd backend  && .venv/bin/python -m pytest && .venv/bin/ruff check . && .venv/bin/ruff format --check .
cd frontend && npm test && npm run lint && npm run build
```

Backend tests use a separate `shop_test` database created automatically. See [docs/TESTS.md](docs/TESTS.md) for what each file proves.

### Remove everything

```bash
docker compose down -v                     # the database container and its volume
rm -rf backend/.venv backend/uploads frontend/node_modules
```

## Configuration

| Variable | Where | Purpose |
|---|---|---|
| `ENV` | backend | `development` or `production` (production requires R2 and a strong `JWT_SECRET`) |
| `DATABASE_URL` | backend | PostgreSQL connection string (Railway's `postgresql://` form works) |
| `JWT_SECRET` | backend | Secret for tokens; at least 32 random characters in production |
| `FRONTEND_URL`, `CORS_ORIGINS`, `CORS_ORIGIN_REGEX` | backend | Allowed browser origin(s) |
| `FIRST_ADMIN_EMAIL`, `FIRST_ADMIN_PASSWORD` | backend | The first admin, created at startup if missing |
| `SEED_DEMO`, `DEMO_PASSWORD` | backend | Seed the demo catalog (and a demo customer) at startup |
| `SEED_DEMO_RESET` | backend | One time only: remove all products, brands and categories, then seed. Only acts while the demo catalog is missing; switch it off afterwards |
| `STORAGE_BACKEND` | backend | `local` or `r2` |
| `PUBLIC_API_URL` | backend | Base URL for locally served images |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | backend | Cloudflare R2 (required in production) |
| `VITE_API_URL` | frontend | API address, baked in at build time (no trailing slash) |

### Demo data

With `SEED_DEMO=true` the API seeds a fictional catalog at startup (idempotent): 4 brands (Nuvexa Medical, Orvanta Health, Velmora Care, Medquora), 3 categories (Medical Consumables, Medical Devices, First Aid & Wound Care) and 12 products with 1, 2 or 3 pricing tiers. Each product gets a simple SVG placeholder picture (its name on a plain background); the manager replaces these with real pictures in the admin area. Set `DEMO_PASSWORD` to also create the demo customer `demo.customer@example.com`.

`--reset` (or `SEED_DEMO_RESET=true` on a server) first removes **all** products, brands and categories and their stored images, then seeds the demo data. It only acts while the demo catalog is missing, so leaving the variable on cannot wipe a catalog that was already seeded and edited.

### Images

Uploads are validated (real file type, 5 MB, at most 10 per product), stripped of metadata and re-encoded as WebP. In development they are stored in `backend/uploads` and served at `/media`. In production the API **requires** Cloudflare R2 and refuses to start without it.

## Deployment

1. **Railway (API and database).** New project, add PostgreSQL, add a service from this repository with **Root Directory** `backend` (it uses `railway.json` and the Dockerfile; health check `/healthz`). Set the variables above (`ENV=production`, `JWT_SECRET`, `STORAGE_BACKEND=r2` and the `R2_*` values, `FIRST_ADMIN_*`, `CORS_ORIGINS` and `FRONTEND_URL`, optionally `SEED_DEMO` and `DEMO_PASSWORD`). The container migrates the database, seeds the admin and starts the server. **Every deploy migrates the database.**
2. **Cloudflare R2 (images).** Create a bucket with public access and an API token with read and write on that bucket only.
3. **Vercel (frontend).** Import the repository with **Root Directory** `frontend` (Vite preset) and set `VITE_API_URL` to the Railway URL. `vercel.json` adds the single-page rewrite, cache rules and basic security headers.
4. Put the Vercel URL in Railway's `CORS_ORIGINS` and `FRONTEND_URL`, then redeploy the API.

## API overview

| Area | Endpoints (under `/api/v1`) |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Storefront (public) | `GET /brands`, `GET /categories`, `GET /products` (search, filters, pagination), `GET /products/{id}` |
| Cart | `POST /cart/quote` (public); `GET` and `PUT /me/cart`, `POST /me/cart/merge` (signed in) |
| Admin (admin role) | `/admin/brands`, `/admin/categories`, `/admin/products`, `/admin/products/{id}/tiers`, `/admin/tiers/{id}`, `/admin/products/{id}/images`, `/admin/images/{id}` |
| Health | `GET /healthz` (outside `/api/v1`) |

Every error uses one shape: `{"error": {"code", "message", "fields", "params"}}`. The interface translates errors by `code`.

## How the cart works

- **Guest:** the cart is kept in the browser (ids and a bundle count, never prices).
- **Signed in:** the cart is saved on the server. On sign-in the account's cart is fetched first; a guest cart is then merged into it in **one request** (the same offer adds its bundles, never above 99) and the local copy is cleared. Nothing is saved before that first fetch, so an empty local cart can never wipe the account's cart.
- **Safe retries:** each guest cart carries a merge id. If the server merged but the answer was lost, the retry is recognised and does not add the bundles twice.
- Edits are saved after a short pause, one request at a time; a failed save reloads the server's cart and offers a retry.

## Requirements coverage

| Brief requirement | Where |
|---|---|
| Home page: images, names, all pricing options; 1, 2 and 3 option products; brand and category lists and filters; open a product or add to cart | Home (`/`), the shop (`/shop`) and the demo catalog |
| Product page: info, images, brand, category, all options; choose offer and bundle count; automatic price; add to cart | `/products/:id` |
| Cart: product, offer, bundles, line price; update and remove; totals; different offers as separate lines | `/cart` |
| Admin: list, create, edit, delete products; brands and categories; add, edit, delete tiers; saved to a real database | `/admin` |
| Dynamic tier count, validation of positive quantities and prices | Database `CHECK` constraints, API validation, form validation |
| Display in KWD with three decimals | `frontend/src/lib/money.ts` |
| Responsive layout, loading, error and empty states | Every page; audited in a real browser at 360px, tablet and desktop, in both languages |
| Real backend and database, deployed live | FastAPI and PostgreSQL on Railway, frontend on Vercel |

## AI tools and technologies used

- **Claude Code** (Anthropic, model Claude Sonnet 5.5) planned and wrote the code, the tests and the documentation, working in this repository and running the checks.
- **The `frontend-design` skill** (from Anthropic's public skills repository) guided the visual design of the interface.
- **Development-time tooling, not part of this repository:** puppeteer-core with a local Chrome for screenshots and responsive checks, and axe-core for accessibility audits.
- Technologies: see the tech stack above.

## Known limitations

- **Out of scope by the brief:** checkout, payment, delivery, orders and inventory management. The cart has no stock check, and the cart page says that checkout is not part of the demo.
- **No notice when a price changes.** The cart always shows the current price, but it does not tell a customer that a price changed since they added an item. (A removed offer *is* flagged.)
- **Accounts:** a single admin, created from environment variables; no user-management screen, password reset or change screen, email verification or refresh tokens (a session lasts 60 minutes). The seed never changes an existing admin, so changing `FIRST_ADMIN_PASSWORD` later has no effect on an account that already exists.
- **Public demo credentials:** the admin email and password are shown on the sign-in page and are in the source, so anyone can open Manage Store and edit the demo catalog. Keep nothing real behind that account and change the password after review.
- **Rate limiting** (sign-in and sign-up) is kept in memory per process, which is right for one server instance only.
- **Pictures:** the demo products show generated SVG placeholders until real pictures are uploaded. Uploads accept JPEG, PNG and WebP only (not SVG), up to 5 MB and 10 per product.
- **Arabic content:** the demo data has no Arabic text, so the English text is shown in the Arabic view until the manager adds translations.
- **Search** is a substring match without a full-text or trigram index, which is fine for a small catalog.
- **Carts on several devices** follow "last save wins"; there is no conflict resolution beyond reloading the server's cart after a failed save.
- **Tests:** the API is tested against a real PostgreSQL and the interface with Testing Library. Real-browser checks (screenshots, accessibility, responsive audit) were done by hand and are not automated in CI.
- The API documentation (`/docs`) is public.
