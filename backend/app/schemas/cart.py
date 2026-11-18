from typing import Annotated

from pydantic import BaseModel, Field, field_validator

from app.models.cart import MAX_BUNDLES, MAX_LINES

Bundles = Annotated[int, Field(ge=1, le=MAX_BUNDLES)]


# ---- quote: anyone may price a list of lines; the customer's choices never cause an error ----
class QuoteLineIn(BaseModel):
    product_id: int
    tier_id: int
    bundles: int  # range-checked by the quote itself, so a bad count is reported per line


class QuoteIn(BaseModel):
    lines: list[QuoteLineIn] = Field(default_factory=list, max_length=MAX_LINES)


class QuoteLine(BaseModel):
    product_id: int
    tier_id: int
    bundles: int
    status: str  # "ok", "unavailable" or "invalid"
    product_name: str | None = None
    tier_label: str | None = None
    image_url: str | None = None
    image_alt: str | None = None
    units: int | None = None
    bundle_price_fils: int | None = None
    pack_quantity: int | None = None
    line_total_fils: int | None = None


class QuoteProblem(BaseModel):
    code: str  # "unavailable" or "invalid_bundles"
    index: int


class QuoteTotals(BaseModel):
    line_count: int
    bundle_count: int
    pack_count: int
    total_fils: int


class QuoteOut(BaseModel):
    lines: list[QuoteLine]
    totals: QuoteTotals
    problems: list[QuoteProblem]


# ---- the signed-in cart ----
class CartLineIn(BaseModel):
    product_id: int
    tier_id: int
    bundles: Bundles


class CartLineOut(BaseModel):
    product_id: int
    tier_id: int
    bundles: int


class CartOut(BaseModel):
    lines: list[CartLineOut]


class CartReplaceIn(BaseModel):
    lines: list[CartLineIn] = Field(default_factory=list, max_length=MAX_LINES)

    @field_validator("lines")
    @classmethod
    def _one_line_per_offer(cls, lines: list[CartLineIn]) -> list[CartLineIn]:
        tiers = [line.tier_id for line in lines]
        if len(tiers) != len(set(tiers)):
            raise ValueError("Each offer can appear only once in the cart")
        return lines


class CartMergeIn(BaseModel):
    # Guest carts could contain the same offer twice; merging adds them together.
    lines: list[CartLineIn] = Field(default_factory=list, max_length=MAX_LINES)
    # Identifies THIS guest cart. Sending the same id again returns the cart without merging twice.
    merge_id: str | None = Field(
        default=None, min_length=8, max_length=64, pattern=r"^[A-Za-z0-9-]+$"
    )
