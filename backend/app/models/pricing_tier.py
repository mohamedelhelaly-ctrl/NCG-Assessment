from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.product import Product

MAX_PRICE_FILS = 1_000_000_000  # 1,000,000.000 KWD


class PricingTier(TimestampMixin, Base):
    """One bundle offer: `units` packs sold together for `price_fils` in total (not per pack)."""

    __tablename__ = "pricing_tiers"
    __table_args__ = (
        CheckConstraint("units >= 1", name="ck_pricing_tiers_units"),
        CheckConstraint(
            f"price_fils > 0 AND price_fils <= {MAX_PRICE_FILS}", name="ck_pricing_tiers_price"
        ),
        UniqueConstraint("product_id", "units", name="uq_pricing_tiers_product_units"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"), index=True
    )
    label: Mapped[str] = mapped_column(String(100))
    label_ar: Mapped[str | None] = mapped_column(String(100))
    units: Mapped[int] = mapped_column(Integer)
    price_fils: Mapped[int] = mapped_column(BigInteger)

    product: Mapped["Product"] = relationship(back_populates="tiers")
