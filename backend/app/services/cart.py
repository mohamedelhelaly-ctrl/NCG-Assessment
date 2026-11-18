"""The signed-in cart: save it, and merge a guest cart into it."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import conflict
from app.crud.cart import cart_crud
from app.models.cart import MAX_BUNDLES, MAX_LINES, CartItem
from app.models.user import User
from app.schemas.cart import CartLineIn


async def replace_cart(db: AsyncSession, user: User, lines: list[CartLineIn]) -> list[CartItem]:
    """Make the saved cart exactly these lines, in this order. Ids are not checked on purpose:
    a line whose offer was removed must survive a round trip, and the quote will flag it."""
    cart = await cart_crud.lock(db, user.id)
    await cart_crud.clear(db, cart.id)
    items = [
        CartItem(cart_id=cart.id, product_id=x.product_id, tier_id=x.tier_id, bundles=x.bundles)
        for x in lines
    ]
    db.add_all(items)
    await db.commit()
    return items


async def merge_cart(
    db: AsyncSession, user: User, incoming: list[CartLineIn], merge_id: str | None = None
) -> list[CartItem]:
    """Add a guest cart to the saved one, in one transaction. The same offer adds its bundles
    together (never above 99), another offer becomes a new line.

    With a `merge_id` the merge is idempotent: if this exact merge already happened (the response
    was lost and the browser retried), the cart is returned as it is. Without one it is not, and
    the caller must clear its local cart once the merge succeeds."""
    cart = await cart_crud.lock(db, user.id)
    existing_items = await cart_crud.items(db, cart.id)
    if merge_id is not None and cart.last_merge_id == merge_id:
        await db.commit()  # nothing changed; this just releases the row lock
        return existing_items
    by_tier = {item.tier_id: item for item in existing_items}
    for line in incoming:
        existing = by_tier.get(line.tier_id)
        if existing is not None:
            existing.bundles = min(MAX_BUNDLES, existing.bundles + line.bundles)
            continue
        if len(by_tier) >= MAX_LINES:
            await db.rollback()
            message = f"A cart can hold at most {MAX_LINES} different offers"
            raise conflict("cart_full", message, {"max": MAX_LINES})
        item = CartItem(
            cart_id=cart.id, product_id=line.product_id, tier_id=line.tier_id, bundles=line.bundles
        )
        db.add(item)
        by_tier[line.tier_id] = item
    if merge_id is not None:
        cart.last_merge_id = merge_id
    await db.flush()  # new lines get their ids, which keep the order stable
    await db.commit()
    return sorted(by_tier.values(), key=lambda item: item.id)
