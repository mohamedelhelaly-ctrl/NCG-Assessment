"""Fictional demo catalog: brands, categories, products with 1/2/3/2 pricing tiers, generated
images, and a demo customer. Idempotent. Usage: python -m scripts.seed_demo

Images are drawn with Pillow (a gradient and the product name) and stored through the normal
storage backend, so there are no stock photos, no downloads and no licensing questions.
"""

import asyncio
import io

from PIL import Image, ImageDraw, ImageFont
from sqlalchemy import select

from app.config import get_settings
from app.core.security import MAX_PASSWORD_BYTES, hash_password
from app.crud.user import user_crud
from app.database import SessionLocal, engine
from app.models.brand import Brand
from app.models.category import Category
from app.models.pricing_tier import PricingTier
from app.models.product import Product
from app.models.product_image import ProductImage
from app.services import images as image_rules
from app.services.storage import StorageBackend, get_storage

MARKER_BRAND = "Nova Health"
DEMO_EMAIL = "demo.customer@example.com"

BRANDS = [("Nova Health", "نوفا هيلث"), ("PureCare", None)]
CATEGORIES = [("Wound Care", "العناية بالجروح"), ("Vitamins", None), ("Devices", "الأجهزة")]

# name, name_ar, description, description_ar, brand, category, tiers, palette
# tier: (label, label_ar, units, price in fils)
PRODUCTS = [
    dict(  # Product A: exactly one option
        name="Sterile Gauze Pads",
        name_ar="ضمادات شاش معقمة",
        description="Individually wrapped sterile gauze pads, 10 x 10 cm. Soft, absorbent and lint free.",
        description_ar="ضمادات شاش معقمة ومغلفة بشكل فردي، مقاس 10 × 10 سم. ناعمة وماصة وخالية من الوبر.",
        brand="Nova Health",
        category="Wound Care",
        tiers=[("1 pack", "عبوة واحدة", 1, 3250)],
        colors=((38, 110, 160), (120, 190, 220)),
    ),
    dict(  # Product B: exactly two options (no Arabic description: shows the fallback)
        name="Adhesive Bandage Strips",
        name_ar="شرائط لاصقة للجروح",
        description="Breathable, water resistant bandage strips in assorted sizes. Gentle on skin.",
        description_ar=None,
        brand="PureCare",
        category="Wound Care",
        tiers=[("1 pack", "عبوة واحدة", 1, 2750), ("4 packs", "4 عبوات", 4, 9900)],
        colors=((30, 130, 110), (130, 210, 180)),
    ),
    dict(  # Product C: exactly three options, the brief's example prices
        name="Vitamin C 500 mg",
        name_ar="فيتامين سي 500 ملغ",
        description="Daily vitamin C tablets to support normal immune function. 60 tablets per pack.",
        description_ar="أقراص فيتامين سي اليومية لدعم وظائف المناعة الطبيعية. 60 قرصًا في العبوة.",
        brand="Nova Health",
        category="Vitamins",
        tiers=[
            ("1 pack", "عبوة واحدة", 1, 5500),
            ("4 packs", "4 عبوات", 4, 19500),
            ("12 packs", "12 عبوة", 12, 55000),
        ],
        colors=((200, 110, 20), (245, 200, 110)),
    ),
    dict(  # Extra: no Arabic text at all (demonstrates the English fallback)
        name="Digital Thermometer",
        name_ar=None,
        description="Fast, accurate digital thermometer with a flexible tip and a memory function.",
        description_ar=None,
        brand="PureCare",
        category="Devices",
        tiers=[("1 piece", None, 1, 8500), ("3 pieces", None, 3, 24000)],
        colors=((90, 70, 150), (180, 160, 225)),
    ),
    dict(  # Extra: inactive and without tiers, so visible to admins only
        name="Pulse Oximeter (draft)",
        name_ar=None,
        description="Draft product: not on sale yet.",
        description_ar=None,
        brand="PureCare",
        category="Devices",
        tiers=[],
        colors=((120, 120, 120), (200, 200, 200)),
        is_active=False,
        images=1,
    ),
]


def draw_image(title: str, colors: tuple[tuple[int, int, int], tuple[int, int, int]], variant: int):
    """A 1200x900 gradient card with the product name. `variant` shifts the look per image."""
    width, height = 1200, 900
    top, bottom = colors if variant % 2 == 0 else colors[::-1]
    image = Image.new("RGB", (width, height))
    pixels = image.load()
    for y in range(height):
        t = y / (height - 1)
        row = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        for x in range(width):
            pixels[x, y] = row
    draw = ImageDraw.Draw(image)
    radius = 160 + variant * 70
    cx, cy = (width * (0.25 + 0.25 * variant)) % width, height * 0.35
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=(255, 255, 255))
    font = ImageFont.load_default(size=64)
    draw.text((60, height - 150), title, fill=(255, 255, 255), font=font)
    out = io.BytesIO()
    image.save(out, format="PNG")
    return out.getvalue()


async def seed_catalog(storage: StorageBackend) -> str:
    async with SessionLocal() as db:
        if (await db.execute(select(Brand.id).where(Brand.name == MARKER_BRAND))).first():
            return "exists: demo catalog already present, left unchanged"

        brands = {n: Brand(name=n, name_ar=ar) for n, ar in BRANDS}
        categories = {n: Category(name=n, name_ar=ar) for n, ar in CATEGORIES}
        db.add_all([*brands.values(), *categories.values()])
        await db.flush()

        stored_keys: list[str] = []
        try:
            for spec in PRODUCTS:
                product = Product(
                    brand_id=brands[spec["brand"]].id,
                    category_id=categories[spec["category"]].id,
                    name=spec["name"],
                    name_ar=spec["name_ar"],
                    description=spec["description"],
                    description_ar=spec["description_ar"],
                    is_active=spec.get("is_active", True),
                )
                db.add(product)
                await db.flush()
                for label, label_ar, units, price in spec["tiers"]:
                    db.add(
                        PricingTier(
                            product_id=product.id,
                            label=label,
                            label_ar=label_ar,
                            units=units,
                            price_fils=price,
                        )
                    )
                for position in range(spec.get("images", 3)):
                    png = draw_image(spec["name"], spec["colors"], position)
                    data = await image_rules.process_upload(png)
                    key = image_rules.new_storage_key(product.id)
                    await storage.save(key, data, image_rules.CONTENT_TYPE)
                    stored_keys.append(key)
                    db.add(
                        ProductImage(
                            product_id=product.id,
                            storage_key=key,
                            alt=f"{spec['name']}, view {position + 1}",
                            alt_ar=f"{spec['name_ar']}، صورة {position + 1}"
                            if spec["name_ar"]
                            else None,
                            position=position,
                        )
                    )
            await db.commit()
        except Exception:
            await db.rollback()
            for key in stored_keys:  # do not leave orphaned files behind
                await storage.delete(key)
            raise
    return "created: demo catalog"


async def seed_customer() -> str:
    password = get_settings().demo_password
    if not password:
        return "skipped: DEMO_PASSWORD not set"
    if len(password) < 10 or len(password.encode()) > MAX_PASSWORD_BYTES:
        return "skipped: DEMO_PASSWORD must be 10 to 72 bytes long"
    async with SessionLocal() as db:
        if await user_crud.get_by_email(db, DEMO_EMAIL):
            return "exists: demo customer already present, left unchanged"
        await user_crud.create(
            db,
            email=DEMO_EMAIL,
            full_name="Demo Customer",
            password_hash=hash_password(password),
        )
        await db.commit()
    return "created: demo customer"


async def main() -> None:
    print(f"seed_demo catalog {await seed_catalog(get_storage())}")
    print(f"seed_demo customer {await seed_customer()}")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
