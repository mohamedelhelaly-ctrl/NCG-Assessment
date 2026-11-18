"""Storefront responses. Text is already resolved for the request language (Arabic if present,
else English), so the client never guesses."""

from pydantic import BaseModel


class NamedCount(BaseModel):
    id: int
    name: str
    product_count: int


class Ref(BaseModel):
    id: int
    name: str


class TierPublic(BaseModel):
    id: int
    label: str
    units: int
    price_fils: int


class ImagePublic(BaseModel):
    id: int
    url: str
    alt: str


class ProductCard(BaseModel):
    id: int
    name: str
    description: str
    brand: Ref
    category: Ref
    main_image: ImagePublic | None
    tiers: list[TierPublic]


class ProductDetail(ProductCard):
    images: list[ImagePublic]
