"""The server decides every price. The client sends only product, offer and a bundle count."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import contains_eager

from app.core.i18n import Lang, pick
from app.crud.product import visible
from app.models.cart import MAX_BUNDLES
from app.models.pricing_tier import PricingTier
from app.models.product import Product
from app.schemas.cart import QuoteLineIn
from app.services.storage import StorageBackend


async def quote_lines(
    db: AsyncSession, lines: list[QuoteLineIn], lang: Lang, storage: StorageBackend
) -> dict:
    """Price each line. A line is `ok`, `unavailable` (the offer is gone, the product is hidden, or
    the offer does not belong to that product) or `invalid` (a bundle count outside 1..99). Only
    `ok` lines count towards the totals. Nothing here raises for the customer's choices."""
    tier_ids = {line.tier_id for line in lines}
    found: dict[int, PricingTier] = {}
    if tier_ids:
        stmt = (
            select(PricingTier)
            .join(PricingTier.product)
            .where(PricingTier.id.in_(tier_ids), visible())
            .options(
                contains_eager(PricingTier.product).selectinload(Product.images),
            )
        )
        found = {t.id: t for t in (await db.execute(stmt)).unique().scalars().all()}

    out_lines: list[dict] = []
    problems: list[dict] = []
    line_count = bundle_count = pack_count = total = 0

    for index, line in enumerate(lines):
        base = {"product_id": line.product_id, "tier_id": line.tier_id, "bundles": line.bundles}
        if not 1 <= line.bundles <= MAX_BUNDLES:
            out_lines.append({**base, "status": "invalid"})
            problems.append({"code": "invalid_bundles", "index": index})
            continue
        tier = found.get(line.tier_id)
        if tier is None or tier.product_id != line.product_id:
            out_lines.append({**base, "status": "unavailable"})
            problems.append({"code": "unavailable", "index": index})
            continue

        product = tier.product
        main = product.images[0] if product.images else None
        line_total = line.bundles * tier.price_fils  # the bundle price is the TOTAL for the bundle
        packs = line.bundles * tier.units
        out_lines.append(
            {
                **base,
                "status": "ok",
                "product_name": pick(lang, product.name, product.name_ar),
                "tier_label": pick(lang, tier.label, tier.label_ar),
                "image_url": storage.url(main.storage_key) if main else None,
                "image_alt": pick(lang, main.alt, main.alt_ar) if main else None,
                "units": tier.units,
                "bundle_price_fils": tier.price_fils,
                "pack_quantity": packs,
                "line_total_fils": line_total,
            }
        )
        line_count += 1
        bundle_count += line.bundles
        pack_count += packs
        total += line_total

    return {
        "lines": out_lines,
        "totals": {
            "line_count": line_count,
            "bundle_count": bundle_count,
            "pack_count": pack_count,
            "total_fils": total,
        },
        "problems": problems,
    }
