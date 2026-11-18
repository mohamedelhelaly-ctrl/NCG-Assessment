from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.i18n import Lang, get_lang, pick
from app.crud.product import product_crud
from app.database import get_db
from app.models.brand import Brand
from app.models.product import Product
from app.schemas.catalog import NamedCount

router = APIRouter(prefix="/brands", tags=["catalog"])


@router.get("", response_model=list[NamedCount])
async def list_brands(db: AsyncSession = Depends(get_db), lang: Lang = Depends(get_lang)):
    """Brands that have at least one visible product, with that count."""
    rows = await product_crud.public_counts(db, Product.brand_id, Brand, lang)
    return [
        {"id": b.id, "name": pick(lang, b.name, b.name_ar), "product_count": n} for b, n in rows
    ]
