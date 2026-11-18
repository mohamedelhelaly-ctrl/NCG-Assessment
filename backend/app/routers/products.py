from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import not_found
from app.core.i18n import Lang, get_lang
from app.crud.product import product_crud
from app.database import get_db
from app.schemas.catalog import ProductCard, ProductDetail
from app.schemas.common import Page, make_page
from app.services import catalog_view
from app.services.storage import StorageBackend, get_storage

router = APIRouter(prefix="/products", tags=["catalog"])


@router.get("", response_model=Page[ProductCard])
async def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=48),
    search: str | None = Query(None, max_length=100),
    brand_id: int | None = None,
    category_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    lang: Lang = Depends(get_lang),
    storage: StorageBackend = Depends(get_storage),
):
    products, total = await product_crud.list(
        db,
        page=page,
        page_size=page_size,
        public=True,
        search=(search or "").strip() or None,
        brand_id=brand_id,
        category_id=category_id,
    )
    items = [catalog_view.product_card(p, lang, storage) for p in products]
    return make_page(items, total, page, page_size)


@router.get("/{product_id}", response_model=ProductDetail)
async def get_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    lang: Lang = Depends(get_lang),
    storage: StorageBackend = Depends(get_storage),
):
    product = await product_crud.get_visible(db, product_id)
    if product is None:
        raise not_found("Product not found")
    return catalog_view.product_detail(product, lang, storage)
