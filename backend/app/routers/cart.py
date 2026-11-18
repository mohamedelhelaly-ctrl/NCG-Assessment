from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.i18n import Lang, get_lang
from app.crud.cart import cart_crud
from app.database import get_db
from app.deps import get_current_user, no_store
from app.models.user import User
from app.schemas.cart import CartMergeIn, CartOut, CartReplaceIn, QuoteIn, QuoteOut
from app.services import cart as cart_service
from app.services.quote import quote_lines
from app.services.storage import StorageBackend, get_storage

# Public: anyone may price a list of lines. It reveals only what the storefront already shows.
quote_router = APIRouter(prefix="/cart", tags=["cart"])

# Signed in (guarded in main.py through the permissions config). User data: never cached.
router = APIRouter(prefix="/me/cart", tags=["cart"], dependencies=[Depends(no_store)])


@quote_router.post("/quote", response_model=QuoteOut)
async def quote(
    body: QuoteIn,
    db: AsyncSession = Depends(get_db),
    lang: Lang = Depends(get_lang),
    storage: StorageBackend = Depends(get_storage),
):
    return await quote_lines(db, body.lines, lang, storage)


@router.get("", response_model=CartOut)
async def get_cart(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return {"lines": await cart_crud.lines(db, user.id)}


@router.put("", response_model=CartOut)
async def replace_cart(
    body: CartReplaceIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return {"lines": await cart_service.replace_cart(db, user, body.lines)}


@router.post("/merge", response_model=CartOut)
async def merge_cart(
    body: CartMergeIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return {"lines": await cart_service.merge_cart(db, user, body.lines, body.merge_id)}
