from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.i18n import Lang, get_lang, pick
from app.crud.product import product_crud
from app.database import get_db
from app.models.category import Category
from app.models.product import Product
from app.schemas.catalog import NamedCount

router = APIRouter(prefix="/categories", tags=["catalog"])


@router.get("", response_model=list[NamedCount])
async def list_categories(db: AsyncSession = Depends(get_db), lang: Lang = Depends(get_lang)):
    """Categories that have at least one visible product, with that count."""
    rows = await product_crud.public_counts(db, Product.category_id, Category, lang)
    return [
        {"id": c.id, "name": pick(lang, c.name, c.name_ar), "product_count": n} for c, n in rows
    ]
