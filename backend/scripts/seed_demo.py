"""Fictional demo catalog: 4 brands, 3 categories, 12 products with 1 to 3 pricing tiers each, and
one simple SVG placeholder per product (the product name on a plain background). The manager
replaces the placeholders with real pictures from the admin area. Also seeds a demo customer.

Idempotent: it does nothing when the demo catalog is already there.

Usage:
    python -m scripts.seed_demo            # add the demo data if missing
    python -m scripts.seed_demo --reset    # first remove ALL products, brands and categories (and
                                           # their stored images), then add the demo data
    SEED_DEMO_RESET=true                   # same as --reset, for the startup seed on a server

The reset only runs while the demo catalog is NOT present, so leaving SEED_DEMO_RESET on cannot
wipe a catalog that has already been seeded and edited. Remove the variable after one deploy.
"""

import asyncio
import sys
import textwrap
from xml.sax.saxutils import escape

from sqlalchemy import delete, select

from app.config import get_settings
from app.core.security import MAX_PASSWORD_BYTES, hash_password
from app.crud.user import user_crud
from app.database import SessionLocal, engine
from app.models.brand import Brand
from app.models.category import Category
from app.models.pricing_tier import PricingTier
from app.models.product import Product
from app.models.product_image import ProductImage
from app.services.storage import StorageBackend, get_storage

MARKER_BRAND = "Nuvexa Medical"
DEMO_EMAIL = "demo.customer@example.com"
SVG_TYPE = "image/svg+xml"

BRANDS = ["Nuvexa Medical", "Orvanta Health", "Velmora Care", "Medquora"]
CONSUMABLES = "Medical Consumables"
DEVICES = "Medical Devices"
FIRST_AID = "First Aid & Wound Care"
CATEGORIES = [CONSUMABLES, DEVICES, FIRST_AID]

# Plain background per category, so the placeholders are easy to tell apart in a grid.
TONES = {CONSUMABLES: "#e1f0ea", DEVICES: "#e3ebf5", FIRST_AID: "#fbefd5"}

# name, category, brand, description, tiers as (packs, price in fils)
PRODUCTS = [
    (
        "Nitrile Examination Gloves",
        CONSUMABLES,
        "Nuvexa Medical",
        "Powder-free nitrile gloves for examinations and general clinical use.",
        [(1, 5500), (4, 19500), (12, 55000)],
    ),
    (
        "Disposable Medical Face Masks",
        CONSUMABLES,
        "Velmora Care",
        "Three-layer disposable face masks with soft ear loops, for clinics and everyday use.",
        [(1, 2250), (4, 8000), (12, 22500)],
    ),
    (
        "Disposable Syringes (5ml)",
        CONSUMABLES,
        "Nuvexa Medical",
        "Single-use 5 ml syringes, individually sealed.",
        [(1, 3000), (4, 10500)],
    ),
    (
        "Disposable IV Sets",
        CONSUMABLES,
        "Velmora Care",
        "Single-use intravenous infusion sets with a drip chamber and flow regulator.",
        [(1, 4250), (10, 38000)],
    ),
    (
        "Digital Thermometers",
        DEVICES,
        "Orvanta Health",
        "Digital thermometer with a clear display and a quick reading.",
        [(1, 6750)],
    ),
    (
        "Digital Blood Pressure Monitors",
        DEVICES,
        "Orvanta Health",
        "Upper-arm digital blood pressure monitor with automatic inflation and a reading memory.",
        [(1, 24500)],
    ),
    (
        "Fingertip Pulse Oximeters",
        DEVICES,
        "Orvanta Health",
        "Fingertip pulse oximeter showing oxygen saturation and pulse rate on a small display.",
        [(1, 12500), (2, 23000)],
    ),
    (
        "Digital Weighing Scales",
        DEVICES,
        "Orvanta Health",
        "Digital weighing scale with a large display, for the clinic or at home.",
        [(1, 15750)],
    ),
    (
        "Sterile Gauze Pads",
        FIRST_AID,
        "Medquora",
        "Sterile gauze pads for cleaning and dressing wounds.",
        [(1, 1750), (4, 6250), (12, 18000)],
    ),
    (
        "Medical Adhesive Tape",
        FIRST_AID,
        "Velmora Care",
        "Medical adhesive tape for securing dressings and bandages.",
        [(1, 1250), (6, 6500)],
    ),
    (
        "Adhesive Bandages",
        FIRST_AID,
        "Medquora",
        "Adhesive bandages for minor cuts and grazes.",
        [(1, 1500), (5, 6500), (20, 22000)],
    ),
    (
        "Elastic Crepe Bandages",
        FIRST_AID,
        "Velmora Care",
        "Elastic crepe bandages for compression and support.",
        [(1, 2250)],
    ),
]


def tier_label(packs: int) -> str:
    return f"{packs} pack" if packs == 1 else f"{packs} packs"


def placeholder_svg(title: str, background: str) -> str:
    """A 1200x900 picture: the title, centred, on a plain background. The title is XML-escaped."""
    lines = textwrap.wrap(title, width=16) or [title]
    size, leading = 72, 88
    first_y = 450 - (len(lines) - 1) * leading / 2
    spans = "".join(
        f'<tspan x="600" y="{first_y + i * leading:.0f}">{escape(line)}</tspan>'
        for i, line in enumerate(lines)
    )
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">'
        f'<rect width="1200" height="900" fill="{background}"/>'
        f'<text fill="#1c2a25" font-family="system-ui, Arial, sans-serif" font-size="{size}" '
        f'font-weight="600" text-anchor="middle" dominant-baseline="central">{spans}</text>'
        "</svg>"
    )


async def reset_catalog(storage: StorageBackend) -> int:
    """Remove every product, tier, image row, brand and category, then the stored image files.
    Returns how many files were removed from storage."""
    async with SessionLocal() as db:
        keys = list((await db.execute(select(ProductImage.storage_key))).scalars())
        for model in (PricingTier, ProductImage, Product, Brand, Category):
            await db.execute(delete(model))
        await db.commit()
    removed = 0
    for key in keys:  # after the commit; a leftover file is harmless, a lost row is not
        try:
            await storage.delete(key)
            removed += 1
        except Exception as error:  # noqa: BLE001
            print(f"seed_demo could not delete {key}: {error}")
    return removed


async def seed_catalog(storage: StorageBackend, reset: bool = False) -> str:
    async with SessionLocal() as db:
        present = (await db.execute(select(Brand.id).where(Brand.name == MARKER_BRAND))).first()
    if present:
        note = " (reset ignored: the demo catalog is already there)" if reset else ""
        return f"exists: demo catalog already present, left unchanged{note}"

    removed = await reset_catalog(storage) if reset else None

    async with SessionLocal() as db:
        brands = {name: Brand(name=name) for name in BRANDS}
        categories = {name: Category(name=name) for name in CATEGORIES}
        db.add_all([*brands.values(), *categories.values()])
        await db.flush()

        stored_keys: list[str] = []
        try:
            for name, category, brand, description, tiers in PRODUCTS:
                product = Product(
                    brand_id=brands[brand].id,
                    category_id=categories[category].id,
                    name=name,
                    description=description,
                    is_active=True,
                )
                db.add(product)
                await db.flush()
                for packs, price in tiers:
                    db.add(
                        PricingTier(
                            product_id=product.id,
                            label=tier_label(packs),
                            units=packs,
                            price_fils=price,
                        )
                    )
                key = f"products/{product.id}/placeholder.svg"
                svg = placeholder_svg(name, TONES[category]).encode()
                await storage.save(key, svg, SVG_TYPE)
                stored_keys.append(key)
                db.add(ProductImage(product_id=product.id, storage_key=key, alt=name, position=0))
            await db.commit()
        except Exception:
            await db.rollback()
            for key in stored_keys:  # do not leave orphaned files behind
                await storage.delete(key)
            raise
    suffix = f" (replaced the old catalog, {removed} stored images removed)" if reset else ""
    return f"created: demo catalog{suffix}"


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
    reset = "--reset" in sys.argv or get_settings().seed_demo_reset
    print(f"seed_demo catalog {await seed_catalog(get_storage(), reset=reset)}")
    print(f"seed_demo customer {await seed_customer()}")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
