from collections.abc import AsyncIterator
from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.config import get_settings


def _split_url(url: str) -> str:
    """Return the URL without a driver suffix, accepting postgres:// and postgresql://."""
    for prefix in (
        "postgresql+asyncpg://",
        "postgresql+psycopg://",
        "postgresql://",
        "postgres://",
    ):
        if url.startswith(prefix):
            return url[len(prefix) :]
    raise ValueError("DATABASE_URL must start with postgresql:// or postgres://")


def async_url(url: str) -> str:
    return "postgresql+asyncpg://" + _split_url(url)


def sync_url(url: str) -> str:
    return "postgresql+psycopg://" + _split_url(url)


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


engine = create_async_engine(async_url(get_settings().database_url), pool_size=5, max_overflow=5)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
