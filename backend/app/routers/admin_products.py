from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import not_found
from app.core.i18n import Lang, get_lang
from app.crud.product import product_crud
from app.database import get_db
from app.schemas.admin import ProductAdmin, ProductCreate, ProductIn, ProductListItem
from app.schemas.common import Page, make_page
from app.services import catalog_view, product_admin
from app.services.storage import StorageBackend, get_storage

router = APIRouter(prefix="/admin/products", tags=["admin products"])


@router.get("", response_model=Page[ProductListItem])
async def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, max_length=100),
    brand_id: int | None = None,
    category_id: int | None = None,
    status: str = Query("all", pattern="^(all|active|inactive|no_tiers)$"),
    missing_ar: bool = False,
    db: AsyncSession = Depends(get_db),
    lang: Lang = Depends(get_lang),
    storage: StorageBackend = Depends(get_storage),
):
    products, total = await product_crud.list(
        db,
        page=page,
        page_size=page_size,
        public=False,
        search=(search or "").strip() or None,
        brand_id=brand_id,
        category_id=category_id,
        status=status,
        missing_ar=missing_ar,
    )
    items = [catalog_view.admin_list_item(p, lang, storage) for p in products]
    return make_page(items, total, page, page_size)


@router.post("", response_model=ProductAdmin, status_code=201)
async def create_product(
    body: ProductCreate,
    db: AsyncSession = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
):
    return catalog_view.admin_product(await product_admin.create_product(db, body), storage)


@router.get("/{product_id}", response_model=ProductAdmin)
async def get_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
):
    product = await product_crud.get(db, product_id)
    if product is None:
        raise not_found("Product not found")
    return catalog_view.admin_product(product, storage)


@router.put("/{product_id}", response_model=ProductAdmin)
async def update_product(
    product_id: int,
    body: ProductIn,
    db: AsyncSession = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
):
    product = await product_admin.update_product(db, product_id, body)
    return catalog_view.admin_product(product, storage)


@router.delete("/{product_id}", status_code=204)
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
):
    await product_admin.delete_product(db, storage, product_id)
    return Response(status_code=204)
