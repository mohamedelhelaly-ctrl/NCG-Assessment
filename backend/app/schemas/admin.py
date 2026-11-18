"""Admin requests and responses. Both languages are returned for editing, plus a resolved
`display_name` for lists."""

from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, field_validator

from app.models.pricing_tier import MAX_PRICE_FILS
from app.schemas.common import optional_text, text


class NamedIn(BaseModel):
    name: text(100)
    name_ar: optional_text(100) = None


class NamedAdmin(BaseModel):
    id: int
    name: str
    name_ar: str | None
    display_name: str
    product_count: int


Units = Annotated[int, Field(ge=1, le=1_000_000)]
PriceFils = Annotated[int, Field(gt=0, le=MAX_PRICE_FILS)]


class TierIn(BaseModel):
    label: text(100)
    label_ar: optional_text(100) = None
    units: Units
    price_fils: PriceFils


class TierAdmin(BaseModel):
    id: int
    label: str
    label_ar: str | None
    units: int
    price_fils: int


class ImageAdmin(BaseModel):
    id: int
    url: str
    alt: str
    alt_ar: str | None
    position: int


class ImageUpdate(BaseModel):
    alt: text(200)
    alt_ar: optional_text(200) = None


class ImageOrder(BaseModel):
    image_ids: list[int]


class ProductIn(BaseModel):
    brand_id: int
    category_id: int
    name: text(200)
    name_ar: optional_text(200) = None
    description: text(5000)
    description_ar: optional_text(5000) = None
    is_active: bool = False


class ProductCreate(ProductIn):
    tiers: list[TierIn] = []

    @field_validator("tiers")
    @classmethod
    def _unique_units(cls, tiers: list[TierIn]) -> list[TierIn]:
        units = [t.units for t in tiers]
        if len(units) != len(set(units)):
            raise ValueError("Each tier needs a different number of units")
        return tiers


class ProductListItem(BaseModel):
    id: int
    name: str
    name_ar: str | None
    display_name: str
    brand: str
    category: str
    is_active: bool
    tier_count: int
    image_count: int
    missing_ar: bool
    main_image_url: str | None
    created_at: datetime


class ProductAdmin(BaseModel):
    id: int
    brand_id: int
    category_id: int
    name: str
    name_ar: str | None
    description: str
    description_ar: str | None
    is_active: bool
    tiers: list[TierAdmin]
    images: list[ImageAdmin]
    created_at: datetime
    updated_at: datetime


class TierDeleteResult(BaseModel):
    product_deactivated: bool
