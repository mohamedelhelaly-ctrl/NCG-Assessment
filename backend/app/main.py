from pathlib import Path

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app import models  # noqa: F401  (registers mappers)
from app.config import get_settings, validate_settings
from app.core.errors import register_error_handlers
from app.core.permissions import require_module
from app.core.rate_limit import limiter
from app.database import get_db
from app.routers import (
    admin_brands,
    admin_categories,
    admin_images,
    admin_products,
    admin_tiers,
    auth,
    brands,
    cart,
    categories,
    products,
)

settings = get_settings()

validate_settings(settings)

app = FastAPI(title="MedicStore API", version="0.1.0")
app.state.limiter = limiter
register_error_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Basic hardening on every response: no content-type sniffing, no referrer leaks."""
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    return response


API = "/api/v1"
app.include_router(auth.router, prefix=API)

# Public storefront reads
for public_router in (brands.router, categories.router, products.router, cart.quote_router):
    app.include_router(public_router, prefix=API)

# The signed-in cart: customers and admins (the cart module in the permissions config).
app.include_router(cart.router, prefix=API, dependencies=[Depends(require_module("cart", "write"))])

# Admin area: every router is guarded here, so access control is visible in one place.
admin_guard = [Depends(require_module("catalog_admin", "write"))]
for admin_router in (
    admin_brands.router,
    admin_categories.router,
    admin_products.router,
    admin_tiers.router,
    admin_images.router,
):
    app.include_router(admin_router, prefix=API, dependencies=admin_guard)

# In development, uploaded images are served from disk. Production uses R2 URLs.
if settings.storage_backend == "local":
    Path(settings.uploads_dir).mkdir(parents=True, exist_ok=True)
    app.mount("/media", StaticFiles(directory=settings.uploads_dir), name="media")


@app.get("/healthz", tags=["health"])
async def healthz(db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    """Liveness plus a database ping."""
    await db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "ok"}
