# MedicStore: medical e-commerce with multi-tier pricing

A storefront and admin area for a small catalog where each product has several **bundle offers** (pricing tiers), in English and Arabic.

Status: **M5** (accounts and roles, catalog API, image uploads, demo data, English/Arabic interface, the admin area, the storefront, and the cart: a guest cart in the browser that is saved to the account and merged on sign-in, with prices quoted by the server). See [docs/](docs/) for the [requirements](docs/REQUIREMENTS_DRAFT.md) and the [design](docs/DESIGN.md).

## Layout

```
backend/    FastAPI + SQLAlchemy 2 (async) + Alembic   (Python 3.13)
frontend/   React 19 + TypeScript + Vite + Tailwind v4
docs/       requirements, design
docker-compose.yml   PostgreSQL (and the API image) for local use
```

## Run locally

Nothing is installed globally: Python packages live in `backend/.venv`, Node packages in `frontend/node_modules`, and PostgreSQL runs in Docker. Docker Desktop must be running.

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

docker compose up -d db                       # PostgreSQL on localhost:5433

cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --reload       # http://localhost:8000/docs
.venv/bin/python -m pytest                    # uses a separate shop_test database

cd ../frontend
npm ci
npm run dev                                   # http://localhost:5173
npm test && npm run lint && npm run build
```

## Demo data

With `SEED_DEMO=true` the API seeds a fictional catalog on startup (idempotent): 4 brands (Nuvexa Medical, Orvanta Health, Velmora Care, Medquora), 3 categories (Medical Consumables, Medical Devices, First Aid & Wound Care) and 12 products with 1, 2 or 3 pricing tiers each. Every product gets one simple SVG placeholder (its name on a plain background); the store manager replaces these with real pictures in the admin area. Set `DEMO_PASSWORD` to also create the demo customer `demo.customer@example.com`.

Run it by hand with `.venv/bin/python -m scripts.seed_demo`.

**Replacing an older or edited catalog.** `--reset` (or `SEED_DEMO_RESET=true` on a server) first removes **all** products, brands and categories and their stored images, then seeds the demo data. It only acts while the demo catalog is missing, so leaving the variable on cannot wipe a catalog that was already seeded and edited. Switch it off again after one start.

## Images

Uploads are validated (real file type, 5 MB, at most 10 per product), stripped of metadata and re-encoded as WebP. In development they are stored in `backend/uploads` and served at `/media`. In production the API **requires** Cloudflare R2 (`STORAGE_BACKEND=r2` plus the `R2_*` variables in `backend/.env.example`) and refuses to start without it.

## The cart

- **Guests:** the cart lives in the browser (ids and a bundle count, never prices).
- **Signed in:** the cart is saved on the server. On sign-in the account's cart is fetched first, then the guest cart is merged into it in one request (the same offer adds its bundles, never above 99) and the local copy is cleared. Nothing is saved before that first fetch has finished.
- **Prices:** every price on the cart page comes from `POST /api/v1/cart/quote`. A line whose offer was removed is flagged and left out of the total.
- Checkout, payment and orders are out of scope.

## Languages

The interface is available in English (default) and Arabic (right to left), with a switcher in the header. The choice is remembered in the browser. Text lives in `frontend/src/locales/{en,ar}.json`; a test fails if the two files differ in keys or placeholders. Catalog content (names, descriptions, tier labels, image alt text) has an optional Arabic version per field in the admin forms, and the English text is shown wherever the Arabic is empty.

## Remove everything

```bash
docker compose down -v        # database container and its volume
rm -rf backend/.venv frontend/node_modules
```
