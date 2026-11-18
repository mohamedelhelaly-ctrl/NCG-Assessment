"""Turn ORM objects into response dicts. Public views are resolved for the request language;
admin views carry both languages."""

from app.core.i18n import Lang, pick
from app.models.product import Product
from app.models.product_image import ProductImage
from app.services.storage import StorageBackend


def public_image(image: ProductImage, lang: Lang, storage: StorageBackend) -> dict:
    return {
        "id": image.id,
        "url": storage.url(image.storage_key),
        "alt": pick(lang, image.alt, image.alt_ar),
    }


def product_card(product: Product, lang: Lang, storage: StorageBackend) -> dict:
    images = [public_image(i, lang, storage) for i in product.images]
    return {
        "id": product.id,
        "name": pick(lang, product.name, product.name_ar),
        "description": pick(lang, product.description, product.description_ar),
        "brand": {
            "id": product.brand.id,
            "name": pick(lang, product.brand.name, product.brand.name_ar),
        },
        "category": {
            "id": product.category.id,
            "name": pick(lang, product.category.name, product.category.name_ar),
        },
        "main_image": images[0] if images else None,
        "tiers": [
            {
                "id": t.id,
                "label": pick(lang, t.label, t.label_ar),
                "units": t.units,
                "price_fils": t.price_fils,
            }
            for t in product.tiers
        ],
    }


def product_detail(product: Product, lang: Lang, storage: StorageBackend) -> dict:
    card = product_card(product, lang, storage)
    card["images"] = [public_image(i, lang, storage) for i in product.images]
    return card


def admin_image(image: ProductImage, storage: StorageBackend) -> dict:
    return {
        "id": image.id,
        "url": storage.url(image.storage_key),
        "alt": image.alt,
        "alt_ar": image.alt_ar,
        "position": image.position,
    }


def admin_product(product: Product, storage: StorageBackend) -> dict:
    return {
        "id": product.id,
        "brand_id": product.brand_id,
        "category_id": product.category_id,
        "name": product.name,
        "name_ar": product.name_ar,
        "description": product.description,
        "description_ar": product.description_ar,
        "is_active": product.is_active,
        "tiers": [
            {
                "id": t.id,
                "label": t.label,
                "label_ar": t.label_ar,
                "units": t.units,
                "price_fils": t.price_fils,
            }
            for t in product.tiers
        ],
        "images": [admin_image(i, storage) for i in product.images],
        "created_at": product.created_at,
        "updated_at": product.updated_at,
    }


def admin_list_item(product: Product, lang: Lang, storage: StorageBackend) -> dict:
    return {
        "id": product.id,
        "name": product.name,
        "name_ar": product.name_ar,
        "display_name": pick(lang, product.name, product.name_ar),
        "brand": pick(lang, product.brand.name, product.brand.name_ar),
        "category": pick(lang, product.category.name, product.category.name_ar),
        "is_active": product.is_active,
        "tier_count": len(product.tiers),
        "image_count": len(product.images),
        "missing_ar": product.name_ar is None,
        "main_image_url": storage.url(product.images[0].storage_key) if product.images else None,
        "created_at": product.created_at,
    }
