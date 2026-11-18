from fastapi import Depends, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import unauthorized
from app.core.security import decode_access_token
from app.crud.user import user_crud
from app.database import get_db
from app.models.user import User

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Load the user from the database on every request, so a disabled account or a changed
    role takes effect immediately."""
    if credentials is None:
        raise unauthorized()
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise unauthorized("Invalid or expired token", "invalid_token")
    user = await user_crud.get(db, user_id)
    if user is None or not user.is_active:
        raise unauthorized("Invalid or expired token", "invalid_token")
    return user


async def no_store(response: Response) -> None:
    """User data must never be cached by browsers or proxies."""
    response.headers["Cache-Control"] = "no-store"
