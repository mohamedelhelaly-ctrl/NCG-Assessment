from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app import models  # noqa: F401  (registers mappers)
from app.config import get_settings
from app.database import get_db

settings = get_settings()

app = FastAPI(title="Shop API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz", tags=["health"])
async def healthz(db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    """Liveness plus a database ping."""
    await db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "ok"}
