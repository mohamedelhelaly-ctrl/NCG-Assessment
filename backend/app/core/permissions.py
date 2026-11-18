"""One place that says which role may do what. Guards are built from this config."""

from collections.abc import Callable
from typing import Literal

from fastapi import Depends

from app.core.errors import forbidden
from app.deps import get_current_user
from app.models.user import User

Action = Literal["read", "write"]

PERMISSIONS: dict[str, dict[Action, list[str]]] = {
    "catalog_admin": {"read": ["admin"], "write": ["admin"]},
    "cart": {"read": ["customer", "admin"], "write": ["customer", "admin"]},
}


def require_module(module: str, action: Action) -> Callable:
    """Dependency factory. Raises KeyError at import time for an unknown module (a typo)."""
    allowed = PERMISSIONS[module][action]

    async def guard(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise forbidden()
        return user

    return guard
