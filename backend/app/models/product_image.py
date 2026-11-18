from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.product import Product


class ProductImage(TimestampMixin, Base):
    """The main image is the one with the lowest position (ties broken by id)."""

    __tablename__ = "product_images"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), index=True
    )
    storage_key: Mapped[str] = mapped_column(String(255))
    alt: Mapped[str] = mapped_column(String(200))
    alt_ar: Mapped[str | None] = mapped_column(String(200))
    position: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    product: Mapped["Product"] = relationship(back_populates="images")
