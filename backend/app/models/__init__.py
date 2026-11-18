"""Import every model here so mappers register and Alembic sees them."""

from app.database import Base  # noqa: F401
from app.models.user import User  # noqa: F401
