import pytest
from sqlalchemy import delete, update

from app.database import SessionLocal
from app.models.pricing_tier import PricingTier
from app.models.product import Product
from tests.factories import make_brand, make_category, make_product

QUOTE = "/api/v1/cart/quote"
AR = {"Accept-Language": "ar"}


async def tiers_of(product_id: int) -> dict[int, int]:
    """units -> tier id, for a product made by the factory."""
    from sqlalchemy import select

    async with SessionLocal() as db:
        rows = (
            await db.execute(select(PricingTier).where(PricingTier.product_id == product_id))
        ).scalars()
        return {t.units: t.id for t in rows}


@pytest.fixture
async def gloves():
    """Product C of the brief: one, four and twelve packs at 5.500, 19.500 and 55.000 KWD."""
    brand, category = await make_brand("Nuvexa Medical"), await make_category("Consumables")
    pid = await make_product(
        brand, category, "Gloves", "قفازات", tiers=((1, 5500), (4, 19500), (12, 55000)), images=2
    )
    return pid, await tiers_of(pid)


def line(product_id, tier_id, bundles):
    return {"product_id": product_id, "tier_id": tier_id, "bundles": bundles}


async def quote(client, lines, headers=None):
    r = await client.post(QUOTE, json={"lines": lines}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


# ------------------------------------------------------------------ the brief's example


async def test_two_purchases_of_the_four_pack_offer_is_39_kwd_and_8_packs(client, gloves):
    pid, tiers = gloves
    body = await quote(client, [line(pid, tiers[4], 2)])
    (item,) = body["lines"]
    assert item["status"] == "ok"
    assert item["bundles"] == 2 and item["units"] == 4
    assert item["bundle_price_fils"] == 19500
    assert item["pack_quantity"] == 8  # 2 bundles x 4 packs, not 8 purchases
    assert item["line_total_fils"] == 39000  # 2 x 19.500: the bundle price is not per pack
    assert body["totals"] == {
        "line_count": 1,
        "bundle_count": 2,
        "pack_count": 8,
        "total_fils": 39000,
    }
    assert body["problems"] == []


async def test_the_bundle_price_is_never_multiplied_by_the_pack_count(client, gloves):
    pid, tiers = gloves
    body = await quote(client, [line(pid, tiers[12], 1)])
    assert body["lines"][0]["line_total_fils"] == 55000  # not 12 x 55.000
    assert body["lines"][0]["pack_quantity"] == 12


async def test_different_offers_of_the_same_product_are_separate_lines(client, gloves):
    pid, tiers = gloves
    body = await quote(
        client, [line(pid, tiers[1], 1), line(pid, tiers[4], 2), line(pid, tiers[12], 1)]
    )
    assert [item["pack_quantity"] for item in body["lines"]] == [1, 8, 12]
    assert [item["line_total_fils"] for item in body["lines"]] == [5500, 39000, 55000]
    assert body["totals"]["line_count"] == 3
    assert body["totals"]["pack_count"] == 21
    assert body["totals"]["bundle_count"] == 4
    assert body["totals"]["total_fils"] == 99500


async def test_totals_add_up_exactly_in_fils(client):
    brand, category = await make_brand(), await make_category()
    a = await make_product(brand, category, "A", tiers=((1, 1750),))
    b = await make_product(brand, category, "B", tiers=((6, 6500),))
    ta, tb = (await tiers_of(a))[1], (await tiers_of(b))[6]
    body = await quote(client, [line(a, ta, 3), line(b, tb, 7)])
    assert body["totals"]["total_fils"] == 3 * 1750 + 7 * 6500  # 50.750, no rounding
    assert body["totals"]["pack_count"] == 3 + 42


async def test_a_line_at_the_maximum_of_99_bundles(client, gloves):
    pid, tiers = gloves
    body = await quote(client, [line(pid, tiers[12], 99)])
    assert body["lines"][0]["line_total_fils"] == 99 * 55000
    assert body["lines"][0]["pack_quantity"] == 99 * 12


# ----------------------------------------------------- what the customer sees per line


async def test_a_line_carries_the_name_offer_label_and_main_image(client, gloves):
    pid, tiers = gloves
    (item,) = (await quote(client, [line(pid, tiers[4], 1)]))["lines"]
    assert item["product_name"] == "Gloves"
    assert item["tier_label"] == "4 packs"
    assert item["image_url"].endswith("img0.webp")  # the first picture is the main one
    assert item["image_alt"] == "Gloves 0"


async def test_a_product_without_pictures_has_no_image(client):
    brand, category = await make_brand(), await make_category()
    pid = await make_product(brand, category, "Plain", images=0)
    (item,) = (await quote(client, [line(pid, (await tiers_of(pid))[1], 1)]))["lines"]
    assert item["status"] == "ok" and item["image_url"] is None and item["image_alt"] is None


async def test_names_and_labels_are_resolved_for_the_request_language(client, gloves):
    pid, tiers = gloves
    (en,) = (await quote(client, [line(pid, tiers[4], 1)]))["lines"]
    (ar,) = (await quote(client, [line(pid, tiers[4], 1)], AR))["lines"]
    assert (en["product_name"], en["tier_label"]) == ("Gloves", "4 packs")
    assert (ar["product_name"], ar["tier_label"]) == ("قفازات", "4 عبوة")
    assert ar["image_alt"] == "قفازات 0"
    assert ar["line_total_fils"] == en["line_total_fils"]  # the language never changes a price


async def test_missing_arabic_falls_back_to_english(client):
    brand, category = await make_brand(), await make_category()
    pid = await make_product(brand, category, "Only English", name_ar=None, tiers=((1, 1000),))
    (item,) = (await quote(client, [line(pid, (await tiers_of(pid))[1], 1)], AR))["lines"]
    assert item["product_name"] == "Only English"


# ------------------------------------------- unavailable lines, flagged and excluded


async def test_a_deleted_offer_is_unavailable_and_not_counted(client, gloves):
    pid, tiers = gloves
    async with SessionLocal() as db:
        await db.execute(delete(PricingTier).where(PricingTier.id == tiers[4]))
        await db.commit()
    body = await quote(client, [line(pid, tiers[1], 1), line(pid, tiers[4], 2)])
    assert [item["status"] for item in body["lines"]] == ["ok", "unavailable"]
    assert body["lines"][1]["line_total_fils"] is None and body["lines"][1]["product_name"] is None
    assert body["problems"] == [{"code": "unavailable", "index": 1}]
    assert body["totals"] == {
        "line_count": 1,
        "bundle_count": 1,
        "pack_count": 1,
        "total_fils": 5500,
    }


async def test_an_inactive_product_is_unavailable(client, gloves):
    pid, tiers = gloves
    async with SessionLocal() as db:
        await db.execute(update(Product).where(Product.id == pid).values(is_active=False))
        await db.commit()
    body = await quote(client, [line(pid, tiers[1], 1)])
    assert body["lines"][0]["status"] == "unavailable"
    assert body["totals"]["total_fils"] == 0


async def test_a_deleted_product_is_unavailable(client, gloves):
    pid, tiers = gloves
    async with SessionLocal() as db:
        await db.delete(await db.get(Product, pid))
        await db.commit()
    assert (await quote(client, [line(pid, tiers[1], 1)]))["lines"][0]["status"] == "unavailable"


async def test_an_offer_that_belongs_to_another_product_is_unavailable(client, gloves):
    pid, tiers = gloves
    brand, category = await make_brand("Other"), await make_category("Other")
    other = await make_product(brand, category, "Other", tiers=((1, 100),))
    body = await quote(client, [line(other, tiers[1], 1)])  # right tier id, wrong product
    assert body["lines"][0]["status"] == "unavailable"


@pytest.mark.parametrize("ids", [(999, 999), (0, 0), (-1, -1)])
async def test_unknown_ids_are_unavailable_not_an_error(client, ids):
    body = await quote(client, [line(ids[0], ids[1], 1)])
    assert body["lines"][0]["status"] == "unavailable"


# ---------------------------------------------------------- invalid counts, flagged


@pytest.mark.parametrize("bundles", [0, -1, 100, 1000, -99])
async def test_a_bundle_count_outside_1_to_99_is_invalid_not_an_error(client, gloves, bundles):
    pid, tiers = gloves
    body = await quote(client, [line(pid, tiers[1], bundles), line(pid, tiers[4], 1)])
    assert [item["status"] for item in body["lines"]] == ["invalid", "ok"]
    assert body["problems"] == [{"code": "invalid_bundles", "index": 0}]
    assert body["totals"]["total_fils"] == 19500  # only the valid line counts
    assert body["lines"][0]["line_total_fils"] is None


async def test_a_mix_of_good_bad_and_missing_lines(client, gloves):
    pid, tiers = gloves
    body = await quote(
        client,
        [
            line(pid, tiers[1], 2),
            line(pid, 999, 1),
            line(pid, tiers[12], 0),
            line(pid, tiers[4], 1),
        ],
    )
    assert [item["status"] for item in body["lines"]] == ["ok", "unavailable", "invalid", "ok"]
    assert [(p["code"], p["index"]) for p in body["problems"]] == [
        ("unavailable", 1),
        ("invalid_bundles", 2),
    ]
    assert body["totals"] == {
        "line_count": 2,
        "bundle_count": 3,
        "pack_count": 6,
        "total_fils": 30500,
    }


# ---------------------------------------------------------------- shape and limits


async def test_an_empty_quote_is_empty_totals(client):
    body = await quote(client, [])
    assert body == {
        "lines": [],
        "totals": {"line_count": 0, "bundle_count": 0, "pack_count": 0, "total_fils": 0},
        "problems": [],
    }


async def test_the_same_offer_twice_is_priced_as_two_lines(client, gloves):
    pid, tiers = gloves
    body = await quote(client, [line(pid, tiers[4], 1), line(pid, tiers[4], 2)])
    assert [item["line_total_fils"] for item in body["lines"]] == [19500, 39000]


async def test_at_most_100_lines(client, gloves):
    pid, tiers = gloves
    assert (
        await client.post(QUOTE, json={"lines": [line(pid, tiers[1], 1)] * 100})
    ).status_code == 200
    r = await client.post(QUOTE, json={"lines": [line(pid, tiers[1], 1)] * 101})
    assert r.status_code == 422 and r.json()["error"]["code"] == "validation_error"


@pytest.mark.parametrize(
    "bad",
    [
        {"lines": [{"product_id": 1, "tier_id": 1}]},  # missing field
        {"lines": [{"product_id": "x", "tier_id": 1, "bundles": 1}]},
        {"lines": [{"product_id": 1, "tier_id": 1, "bundles": 1.5}]},
        {"lines": "nope"},
    ],
)
async def test_only_malformed_requests_are_errors(client, bad):
    r = await client.post(QUOTE, json=bad)
    assert r.status_code == 422 and r.json()["error"]["code"] == "validation_error"


async def test_the_quote_needs_no_account(client, gloves):
    pid, tiers = gloves
    r = await client.post(QUOTE, json={"lines": [line(pid, tiers[1], 1)]})
    assert r.status_code == 200  # a guest can price a cart


async def test_the_client_cannot_supply_a_price(client, gloves):
    pid, tiers = gloves
    cheating = {**line(pid, tiers[12], 1), "bundle_price_fils": 1, "line_total_fils": 1, "price": 0}
    body = await quote(client, [cheating])
    assert body["lines"][0]["line_total_fils"] == 55000  # extra fields are ignored
