import os

import psycopg
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.engine import make_url

# Point the app at a separate test database BEFORE the app is imported.
BASE_URL = os.environ.get("DATABASE_URL", "postgresql://shop:shop@localhost:5433/shop")
_url = make_url(BASE_URL)
TEST_DB = f"{_url.database}_test"
os.environ["DATABASE_URL"] = _url.set(database=TEST_DB).render_as_string(hide_password=False)
os.environ["ENV"] = "development"


def _ensure_test_database() -> None:
    admin_url = _url.set(drivername="postgresql").render_as_string(hide_password=False)
    with psycopg.connect(admin_url, autocommit=True) as conn:
        exists = conn.execute("SELECT 1 FROM pg_database WHERE datname = %s", (TEST_DB,)).fetchone()
        if not exists:
            conn.execute(f'CREATE DATABASE "{TEST_DB}"')


_ensure_test_database()

from app.main import app  # noqa: E402


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
