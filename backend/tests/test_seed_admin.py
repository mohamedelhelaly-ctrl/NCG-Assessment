from sqlalchemy import select

from app.config import get_settings
from app.core.security import verify_password
from app.database import SessionLocal
from app.models.user import User
from scripts.seed_admin import seed_admin
from tests.conftest import make_user


def _set(monkeypatch, email, password):
    monkeypatch.setattr(get_settings(), "first_admin_email", email)
    monkeypatch.setattr(get_settings(), "first_admin_password", password)


async def _users():
    async with SessionLocal() as db:
        return (await db.execute(select(User))).scalars().all()


async def test_creates_the_admin(monkeypatch):
    _set(monkeypatch, "Boss@Shop.example", "boss-password-1")
    assert (await seed_admin()).startswith("created")
    (user,) = await _users()
    assert user.role == "admin" and user.email == "boss@shop.example"
    assert verify_password("boss-password-1", user.password_hash)


async def test_is_idempotent_and_never_changes_an_existing_account(monkeypatch):
    existing = await make_user("boss@shop.example", "original-password", role="customer")
    _set(monkeypatch, "boss@shop.example", "different-password-1")
    assert (await seed_admin()).startswith("exists")
    assert (await seed_admin()).startswith("exists")
    (user,) = await _users()
    assert user.id == existing.id and user.role == "customer"
    assert verify_password("original-password", user.password_hash)


async def test_skips_when_not_configured_or_password_weak(monkeypatch):
    _set(monkeypatch, "", "")
    assert (await seed_admin()).startswith("skipped")
    _set(monkeypatch, "boss@shop.example", "short")
    assert (await seed_admin()).startswith("skipped")
    assert await _users() == []
