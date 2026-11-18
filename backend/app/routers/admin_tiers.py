from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.admin import TierAdmin, TierDeleteResult, TierIn
from app.services import product_admin

router = APIRouter(prefix="/admin", tags=["admin tiers"])


@router.post("/products/{product_id}/tiers", response_model=TierAdmin, status_code=201)
async def add_tier(product_id: int, body: TierIn, db: AsyncSession = Depends(get_db)):
    return await product_admin.add_tier(db, product_id, body)


@router.put("/tiers/{tier_id}", response_model=TierAdmin)
async def update_tier(tier_id: int, body: TierIn, db: AsyncSession = Depends(get_db)):
    return await product_admin.update_tier(db, tier_id, body)


@router.delete("/tiers/{tier_id}", response_model=TierDeleteResult)
async def delete_tier(tier_id: int, db: AsyncSession = Depends(get_db)):
    """If this was the last tier of an active product, the product is deactivated."""
    return {"product_deactivated": await product_admin.delete_tier(db, tier_id)}
