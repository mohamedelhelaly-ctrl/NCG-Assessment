from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pricing_tier import PricingTier


class TierCRUD:
    async def get(self, db: AsyncSession, tier_id: int) -> PricingTier | None:
        return await db.get(PricingTier, tier_id)

    async def count(self, db: AsyncSession, product_id: int) -> int:
        stmt = select(func.count(PricingTier.id)).where(PricingTier.product_id == product_id)
        return (await db.execute(stmt)).scalar_one()

    async def units_taken(
        self, db: AsyncSession, product_id: int, units: int, exclude_id: int | None = None
    ) -> bool:
        stmt = select(PricingTier.id).where(
            PricingTier.product_id == product_id, PricingTier.units == units
        )
        if exclude_id is not None:
            stmt = stmt.where(PricingTier.id != exclude_id)
        return (await db.execute(stmt.limit(1))).first() is not None


tier_crud = TierCRUD()
