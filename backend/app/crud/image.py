from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product_image import ProductImage


class ImageCRUD:
    async def get(self, db: AsyncSession, image_id: int) -> ProductImage | None:
        return await db.get(ProductImage, image_id)

    async def for_product(self, db: AsyncSession, product_id: int) -> list[ProductImage]:
        stmt = (
            select(ProductImage)
            .where(ProductImage.product_id == product_id)
            .order_by(ProductImage.position, ProductImage.id)
        )
        return list((await db.execute(stmt)).scalars().all())

    async def next_position(self, db: AsyncSession, product_id: int) -> int:
        stmt = select(func.coalesce(func.max(ProductImage.position), -1)).where(
            ProductImage.product_id == product_id
        )
        return (await db.execute(stmt)).scalar_one() + 1


image_crud = ImageCRUD()
