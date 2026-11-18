"""Create the first admin from FIRST_ADMIN_EMAIL / FIRST_ADMIN_PASSWORD. Idempotent.

An existing account is never modified (its password and role are left alone).
Usage: python -m scripts.seed_admin
"""

import asyncio

from app.config import get_settings
from app.core.security import MAX_PASSWORD_BYTES, hash_password
from app.crud.user import user_crud
from app.database import SessionLocal, engine


async def seed_admin() -> str:
    settings = get_settings()
    email, password = settings.first_admin_email.strip(), settings.first_admin_password
    if not email or not password:
        return "skipped: FIRST_ADMIN_EMAIL / FIRST_ADMIN_PASSWORD not set"
    if len(password) < 10 or len(password.encode()) > MAX_PASSWORD_BYTES:
        return "skipped: FIRST_ADMIN_PASSWORD must be 10 to 72 bytes long"
    async with SessionLocal() as db:
        if await user_crud.get_by_email(db, email):
            return "exists: admin account already present, left unchanged"
        await user_crud.create(
            db,
            email=email,
            full_name="Administrator",
            password_hash=hash_password(password),
            role="admin",
        )
        await db.commit()
    return "created: first admin account"


async def main() -> None:
    print(f"seed_admin {await seed_admin()}")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
