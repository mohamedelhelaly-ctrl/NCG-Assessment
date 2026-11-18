"""Import every model here so mappers register and Alembic sees them."""

from app.database import Base  # noqa: F401
from app.models.brand import Brand  # noqa: F401
from app.models.category import Category  # noqa: F401
from app.models.pricing_tier import PricingTier  # noqa: F401
from app.models.product import Product  # noqa: F401
from app.models.product_image import ProductImage  # noqa: F401
from app.models.user import User  # noqa: F401
