# Shop: medical e-commerce with multi-tier pricing

A storefront and admin area for a small catalog where each product has several **bundle offers** (pricing tiers), in English and Arabic.

Status: **M1** (skeleton, health check, CI, accounts with sign up, login and roles). See [docs/](docs/) for the [requirements](docs/REQUIREMENTS_DRAFT.md) and the [design](docs/DESIGN.md).

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

## Remove everything

```bash
docker compose down -v        # database container and its volume
rm -rf backend/.venv frontend/node_modules
```
