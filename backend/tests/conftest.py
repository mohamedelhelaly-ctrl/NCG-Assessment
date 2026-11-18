import os
from pathlib import Path

import psycopg
import pytest_asyncio
from alembic.config import Config
from httpx import ASGITransport, AsyncClient
from sqlalchemy.engine import make_url

from alembic import command

# Point the app at a separate test database BEFORE the app is imported.
BASE_URL = os.environ.get("DATABASE_URL", "postgresql://shop:shop@localhost:5433/shop")
_url = make_url(BASE_URL)
TEST_DB = f"{_url.database}_test"
os.environ["DATABASE_URL"] = _url.set(database=TEST_DB).render_as_string(hide_password=False)
os.environ["ENV"] = "development"
os.environ["JWT_SECRET"] = "test-secret-test-secret-test-secret-123"


def _ensure_test_database() -> None:
    admin_url = _url.set(drivername="postgresql").render_as_string(hide_password=False)
    with psycopg.connect(admin_url, autocommit=True) as conn:
        exists = conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (TEST_DB,)).fetchone()
        if not exists:
            conn.execute(f'CREATE DATABASE "{TEST_DB}"')


_ensure_test_database()
command.upgrade(Config(str(Path(__file__).parent.parent / "alembic.ini")), "head")

from sqlalchemy import text  # noqa: E402

from app.core.rate_limit import limiter  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.crud.user import user_crud  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402

limiter.enabled = False  # tests that exercise rate limiting switch it on explicitly


@pytest_asyncio.fixture(autouse=True)
async def clean_db():
    async with SessionLocal() as db:
        await db.execute(text("TRUNCATE users RESTART IDENTITY CASCADE"))
        await db.commit()
    limiter.reset()
    yield


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def make_user(
    email: str = "user@shop.example",
    password: str = "correct-horse-1",
    role: str = "customer",
    is_active: bool = True,
):
    async with SessionLocal() as db:
        user = await user_crud.create(
            db, email=email, full_name="Test User", password_hash=hash_password(password), role=role
        )
        user.is_active = is_active
        await db.commit()
        return user


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
