"""Direct-to-database builders, so public-catalog tests do not depend on the admin API."""

from app.database import SessionLocal
from app.models.brand import Brand
from app.models.category import Category
from app.models.pricing_tier import PricingTier
from app.models.product import Product
from app.models.product_image import ProductImage


async def make_brand(name="Nova Health", name_ar=None) -> int:
    async with SessionLocal() as db:
        brand = Brand(name=name, name_ar=name_ar)
        db.add(brand)
        await db.commit()
        return brand.id


async def make_category(name="Wound Care", name_ar=None) -> int:
    async with SessionLocal() as db:
        category = Category(name=name, name_ar=name_ar)
        db.add(category)
        await db.commit()
        return category.id


async def make_product(
    brand_id: int,
    category_id: int,
    name="Gauze",
    name_ar=None,
    description="A product",
    description_ar=None,
    is_active=True,
    tiers=((1, 1000),),
    images=0,
) -> int:
    """`tiers` is a sequence of (units, price_fils). Tier labels are generated."""
    async with SessionLocal() as db:
        product = Product(
            brand_id=brand_id,
            category_id=category_id,
            name=name,
            name_ar=name_ar,
            description=description,
            description_ar=description_ar,
            is_active=is_active,
        )
        db.add(product)
        await db.flush()
        for units, price in tiers:
            db.add(
                PricingTier(
                    product_id=product.id,
                    label=f"{units} pack{'s' if units > 1 else ''}",
                    label_ar=f"{units} عبوة",
                    units=units,
                    price_fils=price,
                )
            )
        for position in range(images):
            db.add(
                ProductImage(
                    product_id=product.id,
                    storage_key=f"products/{product.id}/img{position}.webp",
                    alt=f"{name} {position}",
                    alt_ar=f"{name_ar} {position}" if name_ar else None,
                    position=position,
                )
            )
        await db.commit()
        return product.id
