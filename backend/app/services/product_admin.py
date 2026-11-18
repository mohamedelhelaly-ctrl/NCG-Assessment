"""Admin business rules for products, tiers and images."""

import logging

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, conflict, not_found
from app.crud.image import image_crud
from app.crud.named import brand_crud, category_crud
from app.crud.product import product_crud
from app.crud.tier import tier_crud
from app.models.pricing_tier import PricingTier
from app.models.product import Product
from app.models.product_image import ProductImage
from app.schemas.admin import ImageUpdate, ProductCreate, ProductIn, TierIn
from app.services import images as image_rules
from app.services.storage import StorageBackend

log = logging.getLogger(__name__)

NEEDS_TIER = "A product needs at least one pricing tier before it can be active"


def _duplicate_units(units: int) -> AppError:
    message = f"This product already has a tier of {units} units"
    return AppError(409, "duplicate_units", message, fields={"units": message})


async def _check_refs(db: AsyncSession, brand_id: int, category_id: int) -> None:
    fields = {}
    if await brand_crud.get(db, brand_id) is None:
        fields["brand_id"] = "Brand does not exist"
    if await category_crud.get(db, category_id) is None:
        fields["category_id"] = "Category does not exist"
    if fields:
        raise AppError(422, "validation_error", "Some fields are invalid", fields)


async def _get_product(db: AsyncSession, product_id: int) -> Product:
    product = await product_crud.get(db, product_id)
    if product is None:
        raise not_found("Product not found")
    return product


async def _reload(db: AsyncSession, product_id: int) -> Product:
    db.expire_all()
    return await _get_product(db, product_id)


async def _delete_stored(storage: StorageBackend, keys: list[str]) -> None:
    """Best effort, after the database commit: a leftover file is harmless, a lost row is not."""
    for key in keys:
        try:
            await storage.delete(key)
        except Exception:  # noqa: BLE001
            log.warning("Could not delete stored image %s", key, exc_info=True)


# ---- products ----------------------------------------------------------------------------


async def create_product(db: AsyncSession, data: ProductCreate) -> Product:
    await _check_refs(db, data.brand_id, data.category_id)
    if data.is_active and not data.tiers:
        raise conflict("product_needs_tier", NEEDS_TIER)
    product = Product(**data.model_dump(exclude={"tiers"}))
    product.tiers = [PricingTier(**t.model_dump()) for t in data.tiers]
    db.add(product)
    await db.commit()
    return await _reload(db, product.id)


async def update_product(db: AsyncSession, product_id: int, data: ProductIn) -> Product:
    product = await _get_product(db, product_id)
    await _check_refs(db, data.brand_id, data.category_id)
    if data.is_active and not product.tiers:
        raise conflict("product_needs_tier", NEEDS_TIER)
    for field, value in data.model_dump().items():
        setattr(product, field, value)
    await db.commit()
    return await _reload(db, product_id)


async def delete_product(db: AsyncSession, storage: StorageBackend, product_id: int) -> None:
    product = await _get_product(db, product_id)
    keys = [image.storage_key for image in product.images]
    await db.delete(product)  # tiers and image rows go with it (ON DELETE CASCADE)
    await db.commit()
    await _delete_stored(storage, keys)


# ---- tiers -------------------------------------------------------------------------------


async def add_tier(db: AsyncSession, product_id: int, data: TierIn) -> PricingTier:
    await _get_product(db, product_id)
    if await tier_crud.units_taken(db, product_id, data.units):
        raise _duplicate_units(data.units)
    tier = PricingTier(product_id=product_id, **data.model_dump())
    db.add(tier)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise _duplicate_units(data.units) from None
    return tier


async def update_tier(db: AsyncSession, tier_id: int, data: TierIn) -> PricingTier:
    tier = await tier_crud.get(db, tier_id)
    if tier is None:
        raise not_found("Tier not found")
    if await tier_crud.units_taken(db, tier.product_id, data.units, exclude_id=tier.id):
        raise _duplicate_units(data.units)
    for field, value in data.model_dump().items():
        setattr(tier, field, value)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise _duplicate_units(data.units) from None
    return tier


async def delete_tier(db: AsyncSession, tier_id: int) -> bool:
    """Returns True when the product was deactivated because this was its last tier."""
    tier = await tier_crud.get(db, tier_id)
    if tier is None:
        raise not_found("Tier not found")
    product = await db.get(Product, tier.product_id)
    await db.delete(tier)
    await db.flush()
    deactivated = False
    if product.is_active and await tier_crud.count(db, product.id) == 0:
        product.is_active = False  # a product without tiers can never be active
        deactivated = True
    await db.commit()
    return deactivated


# ---- images ------------------------------------------------------------------------------


async def add_image(
    db: AsyncSession,
    storage: StorageBackend,
    product_id: int,
    data: bytes,
    alt: str,
    alt_ar: str | None,
) -> ProductImage:
    await _get_product(db, product_id)
    existing = await image_crud.for_product(db, product_id)
    if len(existing) >= image_rules.MAX_IMAGES_PER_PRODUCT:
        raise conflict(
            "too_many_images",
            f"A product can have at most {image_rules.MAX_IMAGES_PER_PRODUCT} images",
            {"max": image_rules.MAX_IMAGES_PER_PRODUCT},
        )
    processed = await image_rules.process_upload(data)
    key = image_rules.new_storage_key(product_id)
    await storage.save(key, processed, image_rules.CONTENT_TYPE)
    image = ProductImage(
        product_id=product_id,
        storage_key=key,
        alt=alt,
        alt_ar=alt_ar,
        position=await image_crud.next_position(db, product_id),
    )
    db.add(image)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        await _delete_stored(storage, [key])
        raise
    return image


async def update_image(db: AsyncSession, image_id: int, data: ImageUpdate) -> ProductImage:
    image = await image_crud.get(db, image_id)
    if image is None:
        raise not_found("Image not found")
    image.alt, image.alt_ar = data.alt, data.alt_ar
    await db.commit()
    return image


async def reorder_images(
    db: AsyncSession, product_id: int, image_ids: list[int]
) -> list[ProductImage]:
    """The first id becomes the main image. The list must contain every image exactly once."""
    await _get_product(db, product_id)
    images = await image_crud.for_product(db, product_id)
    if sorted(image_ids) != sorted(i.id for i in images):
        message = "image_ids must list every image of this product exactly once"
        raise AppError(422, "validation_error", message, {"image_ids": message})
    by_id = {i.id: i for i in images}
    for position, image_id in enumerate(image_ids):
        by_id[image_id].position = position
    await db.commit()
    return [by_id[i] for i in image_ids]


async def delete_image(db: AsyncSession, storage: StorageBackend, image_id: int) -> None:
    image = await image_crud.get(db, image_id)
    if image is None:
        raise not_found("Image not found")
    key = image.storage_key
    await db.delete(image)
    await db.commit()
    await _delete_stored(storage, [key])
