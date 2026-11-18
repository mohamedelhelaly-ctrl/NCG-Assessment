from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class UserCRUD:
    async def get(self, db: AsyncSession, user_id: int) -> User | None:
        return await db.get(User, user_id)

    async def get_by_email(self, db: AsyncSession, email: str) -> User | None:
        result = await db.execute(select(User).where(User.email == email.strip().lower()))
        return result.scalar_one_or_none()

    async def create(
        self,
        db: AsyncSession,
        *,
        email: str,
        full_name: str,
        password_hash: str,
        role: str = "customer",
    ) -> User:
        user = User(
            email=email.strip().lower(), full_name=full_name, password_hash=password_hash, role=role
        )
        db.add(user)
        await db.flush()
        return user


user_crud = UserCRUD()
