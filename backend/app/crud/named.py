"""Brands and categories share one shape (name, optional Arabic name), so one class serves both."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.brand import Brand
from app.models.category import Category
from app.models.product import Product


class NamedCRUD[M: (Brand, Category)]:
    def __init__(self, model: type[M], product_fk: str):
        self.model = model
        self.product_column = getattr(Product, product_fk)

    async def get(self, db: AsyncSession, item_id: int) -> M | None:
        return await db.get(self.model, item_id)

    async def list_with_counts(self, db: AsyncSession) -> list[tuple[M, int]]:
        """Every row with the number of products (any status) that use it."""
        stmt = (
            select(self.model, func.count(Product.id))
            .outerjoin(Product, self.product_column == self.model.id)
            .group_by(self.model.id)
            .order_by(func.lower(self.model.name), self.model.id)
        )
        return [(row[0], row[1]) for row in (await db.execute(stmt)).all()]

    async def count_products(self, db: AsyncSession, item_id: int) -> int:
        stmt = select(func.count(Product.id)).where(self.product_column == item_id)
        return (await db.execute(stmt)).scalar_one()

    async def name_taken(self, db: AsyncSession, name: str, exclude_id: int | None = None) -> bool:
        stmt = select(self.model.id).where(func.lower(self.model.name) == name.strip().lower())
        if exclude_id is not None:
            stmt = stmt.where(self.model.id != exclude_id)
        return (await db.execute(stmt.limit(1))).first() is not None


brand_crud = NamedCRUD(Brand, "brand_id")
category_crud = NamedCRUD(Category, "category_id")
