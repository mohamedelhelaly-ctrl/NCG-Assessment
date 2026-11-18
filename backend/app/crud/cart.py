from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cart import Cart, CartItem


class CartCRUD:
    async def lines(self, db: AsyncSession, user_id: int) -> list[CartItem]:
        """The user's lines in the order they were added. An unsaved cart is simply empty."""
        stmt = (
            select(CartItem)
            .join(Cart, Cart.id == CartItem.cart_id)
            .where(Cart.user_id == user_id)
            .order_by(CartItem.id)
        )
        return list((await db.execute(stmt)).scalars().all())

    async def lock(self, db: AsyncSession, user_id: int) -> Cart:
        """Create the cart if needed and lock its row, so two saves for one user run one after the
        other. The insert ignores a concurrent insert of the same user."""
        await db.execute(
            pg_insert(Cart)
            .values(user_id=user_id)
            .on_conflict_do_nothing(index_elements=["user_id"])
        )
        stmt = select(Cart).where(Cart.user_id == user_id).with_for_update()
        return (await db.execute(stmt)).scalar_one()

    async def items(self, db: AsyncSession, cart_id: int) -> list[CartItem]:
        stmt = select(CartItem).where(CartItem.cart_id == cart_id).order_by(CartItem.id)
        return list((await db.execute(stmt)).scalars().all())

    async def clear(self, db: AsyncSession, cart_id: int) -> None:
        await db.execute(delete(CartItem).where(CartItem.cart_id == cart_id))


cart_crud = CartCRUD()
