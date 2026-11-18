from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin
from app.models.brand import Brand
from app.models.category import Category
from app.models.pricing_tier import PricingTier
from app.models.product_image import ProductImage


class Product(TimestampMixin, Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id", ondelete="RESTRICT"), index=True)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str] = mapped_column(String(200))
    name_ar: Mapped[str | None] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    description_ar: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    brand: Mapped[Brand] = relationship()
    category: Mapped[Category] = relationship()
    tiers: Mapped[list[PricingTier]] = relationship(
        back_populates="product",
        order_by=PricingTier.units,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    images: Mapped[list[ProductImage]] = relationship(
        back_populates="product",
        order_by=(ProductImage.position, ProductImage.id),
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
