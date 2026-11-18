from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app import models  # noqa: F401  (registers mappers)
from app.config import get_settings
from app.core.errors import register_error_handlers
from app.core.rate_limit import limiter
from app.database import get_db
from app.routers import auth

settings = get_settings()

if settings.is_production and (
    settings.jwt_secret.startswith(("dev-only", "change-me")) or len(settings.jwt_secret) < 32
):
    raise RuntimeError("JWT_SECRET must be set to a random value of at least 32 characters")

app = FastAPI(title="Shop API", version="0.1.0")
app.state.limiter = limiter
register_error_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")


@app.get("/healthz", tags=["health"])
async def healthz(db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    """Liveness plus a database ping."""
    await db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "ok"}
