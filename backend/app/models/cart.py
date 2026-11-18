from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base, TimestampMixin

MAX_BUNDLES = 99
MAX_LINES = 100


class Cart(TimestampMixin, Base):
    """A signed-in customer's cart. One per user, created the first time it is saved."""

    __tablename__ = "carts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )
    # The id of the last guest cart merged into this cart. A repeat of the same merge (the browser
    # never heard the answer and tries again) is recognised and does not add the bundles twice.
    last_merge_id: Mapped[str | None] = mapped_column(String(64))


class CartItem(TimestampMixin, Base):
    """One line: some bundles of one offer (tier). The prices are never stored; the quote looks
    them up. `product_id` and `tier_id` are deliberately NOT foreign keys: if an admin deletes a
    tier, the line must survive so the quote can report it as unavailable instead of it silently
    vanishing from the customer's cart."""

    __tablename__ = "cart_items"
    __table_args__ = (
        CheckConstraint(f"bundles BETWEEN 1 AND {MAX_BUNDLES}", name="ck_cart_items_bundles"),
        UniqueConstraint("cart_id", "tier_id", name="uq_cart_items_cart_tier"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    cart_id: Mapped[int] = mapped_column(ForeignKey("carts.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(Integer)
    tier_id: Mapped[int] = mapped_column(Integer)
    bundles: Mapped[int] = mapped_column(Integer)
