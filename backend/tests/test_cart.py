import asyncio

import pytest
from sqlalchemy import delete, func, select, text

from app.core.security import create_access_token
from app.database import SessionLocal
from app.models.cart import Cart, CartItem
from app.models.pricing_tier import PricingTier
from app.models.user import User
from tests.conftest import auth_header, make_user
from tests.factories import make_brand, make_category, make_product

CART = "/api/v1/me/cart"
MERGE = "/api/v1/me/cart/merge"
QUOTE = "/api/v1/cart/quote"


def ln(product_id, tier_id, bundles):
    return {"product_id": product_id, "tier_id": tier_id, "bundles": bundles}


async def headers_for(email="shopper@shop.example", role="customer"):
    user = await make_user(email, role=role)
    return auth_header(create_access_token(user.id)), user


@pytest.fixture
async def shopper():
    headers, user = await headers_for()
    return headers


async def put(client, headers, lines):
    return await client.put(CART, json={"lines": lines}, headers=headers)


async def current(client, headers):
    r = await client.get(CART, headers=headers)
    assert r.status_code == 200
    return r.json()["lines"]


# ---------------------------------------------------------------------- access


async def test_a_guest_cannot_use_the_saved_cart(client):
    assert (await client.get(CART)).status_code == 401
    assert (await client.put(CART, json={"lines": []})).status_code == 401
    assert (await client.post(MERGE, json={"lines": []})).status_code == 401


async def test_customers_and_admins_both_have_a_cart(client):
    for email, role in (("c@shop.example", "customer"), ("a@shop.example", "admin")):
        headers, _ = await headers_for(email, role)
        assert (await put(client, headers, [ln(1, 1, 1)])).status_code == 200
        assert await current(client, headers) == [ln(1, 1, 1)]


async def test_a_disabled_account_cannot_use_its_cart(client):
    user = await make_user("off@shop.example", is_active=False)
    r = await client.get(CART, headers=auth_header(create_access_token(user.id)))
    assert r.status_code == 401


async def test_cart_responses_are_never_cached(client, shopper):
    assert (await client.get(CART, headers=shopper)).headers["cache-control"] == "no-store"
    assert (await put(client, shopper, [])).headers["cache-control"] == "no-store"


async def test_everyone_has_their_own_cart(client):
    alice, _ = await headers_for("alice@shop.example")
    bob, _ = await headers_for("bob@shop.example")
    await put(client, alice, [ln(1, 10, 2)])
    await put(client, bob, [ln(2, 20, 5)])
    assert await current(client, alice) == [ln(1, 10, 2)]
    assert await current(client, bob) == [ln(2, 20, 5)]
    await put(client, bob, [])
    assert await current(client, alice) == [ln(1, 10, 2)]  # bob's change never touches alice


# ------------------------------------------------------------------- reading


async def test_a_new_account_has_an_empty_cart_and_reading_creates_nothing(client, shopper):
    assert await current(client, shopper) == []
    async with SessionLocal() as db:
        assert (await db.execute(select(func.count(Cart.id)))).scalar_one() == 0


# -------------------------------------------------------------- saving (replace)


async def test_saving_replaces_the_whole_cart_and_keeps_the_order(client, shopper):
    await put(client, shopper, [ln(1, 10, 1), ln(1, 11, 2), ln(2, 20, 3)])
    assert [item["tier_id"] for item in await current(client, shopper)] == [10, 11, 20]
    await put(client, shopper, [ln(2, 20, 4), ln(1, 10, 1)])
    assert await current(client, shopper) == [ln(2, 20, 4), ln(1, 10, 1)]


async def test_saving_an_empty_list_empties_the_cart(client, shopper):
    await put(client, shopper, [ln(1, 10, 1)])
    assert (await put(client, shopper, [])).json() == {"lines": []}
    assert await current(client, shopper) == []


async def test_saving_returns_the_saved_lines(client, shopper):
    r = await put(client, shopper, [ln(1, 10, 3)])
    assert r.status_code == 200 and r.json() == {"lines": [ln(1, 10, 3)]}


@pytest.mark.parametrize("bundles", [0, -1, 100, 1000])
async def test_a_bundle_count_outside_1_to_99_is_rejected(client, shopper, bundles):
    await put(client, shopper, [ln(1, 10, 5)])
    r = await put(client, shopper, [ln(1, 10, bundles)])
    assert r.status_code == 422 and r.json()["error"]["code"] == "validation_error"
    assert await current(client, shopper) == [ln(1, 10, 5)]  # nothing was changed


async def test_the_same_offer_twice_is_rejected(client, shopper):
    r = await put(client, shopper, [ln(1, 10, 1), ln(1, 10, 2)])
    assert r.status_code == 422
    assert "only once" in r.json()["error"]["fields"]["lines"]


async def test_at_most_100_different_offers(client, shopper):
    assert (await put(client, shopper, [ln(1, i, 1) for i in range(100)])).status_code == 200
    assert (await put(client, shopper, [ln(1, i, 1) for i in range(101)])).status_code == 422


@pytest.mark.parametrize(
    "bad",
    [
        {"lines": "x"},
        {"lines": [{"tier_id": 1, "bundles": 1}]},
        {"lines": [{"product_id": 1, "tier_id": 1, "bundles": 1.5}]},
    ],
)
async def test_malformed_saves_are_rejected(client, shopper, bad):
    assert (await client.put(CART, json=bad, headers=shopper)).status_code == 422


async def test_ids_are_not_checked_so_a_stale_line_survives_a_round_trip(client, shopper):
    """An offer an admin deleted must not make the customer's cart fail to save."""
    stale = [ln(999, 999, 2), ln(1, 10, 1)]
    await put(client, shopper, stale)
    assert await current(client, shopper) == stale
    await put(client, shopper, await current(client, shopper))
    assert await current(client, shopper) == stale


async def test_a_line_whose_offer_is_deleted_stays_and_the_quote_flags_it(client, shopper):
    brand, category = await make_brand(), await make_category()
    pid = await make_product(brand, category, "Gloves", tiers=((1, 5500), (4, 19500)))
    async with SessionLocal() as db:
        tiers = {t.units: t.id for t in (await db.execute(select(PricingTier))).scalars()}
    await put(client, shopper, [ln(pid, tiers[1], 1), ln(pid, tiers[4], 2)])
    async with SessionLocal() as db:
        await db.execute(delete(PricingTier).where(PricingTier.id == tiers[4]))
        await db.commit()
    lines = await current(client, shopper)
    assert len(lines) == 2  # the line is still there (no foreign key removed it)
    quoted = (await client.post(QUOTE, json={"lines": lines})).json()
    assert [item["status"] for item in quoted["lines"]] == ["ok", "unavailable"]
    assert quoted["totals"]["total_fils"] == 5500


# ----------------------------------------------------------- merging a guest cart


async def test_merging_into_an_empty_cart_saves_the_guest_cart(client, shopper):
    r = await client.post(MERGE, json={"lines": [ln(1, 10, 2), ln(1, 11, 1)]}, headers=shopper)
    assert r.status_code == 200
    assert r.json()["lines"] == [ln(1, 10, 2), ln(1, 11, 1)]
    assert await current(client, shopper) == [ln(1, 10, 2), ln(1, 11, 1)]


async def test_the_same_offer_adds_its_bundles_together(client, shopper):
    await put(client, shopper, [ln(1, 10, 2), ln(2, 20, 1)])
    r = await client.post(MERGE, json={"lines": [ln(1, 10, 3)]}, headers=shopper)
    assert r.json()["lines"] == [ln(1, 10, 5), ln(2, 20, 1)]


async def test_a_merged_line_is_capped_at_99_bundles(client, shopper):
    await put(client, shopper, [ln(1, 10, 98)])
    r = await client.post(MERGE, json={"lines": [ln(1, 10, 50)]}, headers=shopper)
    assert r.json()["lines"] == [ln(1, 10, 99)]


async def test_another_offer_of_the_same_product_becomes_its_own_line(client, shopper):
    await put(client, shopper, [ln(1, 10, 1)])
    r = await client.post(MERGE, json={"lines": [ln(1, 11, 1)]}, headers=shopper)
    assert r.json()["lines"] == [ln(1, 10, 1), ln(1, 11, 1)]


async def test_new_lines_go_after_the_existing_ones_in_the_order_given(client, shopper):
    await put(client, shopper, [ln(1, 10, 1)])
    r = await client.post(MERGE, json={"lines": [ln(3, 30, 1), ln(2, 20, 1)]}, headers=shopper)
    assert [item["tier_id"] for item in r.json()["lines"]] == [10, 30, 20]


async def test_duplicates_inside_the_guest_cart_are_added_together(client, shopper):
    r = await client.post(MERGE, json={"lines": [ln(1, 10, 2), ln(1, 10, 3)]}, headers=shopper)
    assert r.json()["lines"] == [ln(1, 10, 5)]


async def test_merging_keeps_a_stale_line_for_the_quote_to_flag(client, shopper):
    r = await client.post(MERGE, json={"lines": [ln(999, 999, 1)]}, headers=shopper)
    assert r.json()["lines"] == [ln(999, 999, 1)]


async def test_merging_nothing_changes_nothing(client, shopper):
    await put(client, shopper, [ln(1, 10, 4)])
    r = await client.post(MERGE, json={"lines": []}, headers=shopper)
    assert r.json()["lines"] == [ln(1, 10, 4)]


@pytest.mark.parametrize("bundles", [0, 100, -3])
async def test_an_invalid_guest_line_rejects_the_whole_merge(client, shopper, bundles):
    await put(client, shopper, [ln(1, 10, 1)])
    r = await client.post(
        MERGE, json={"lines": [ln(2, 20, 1), ln(3, 30, bundles)]}, headers=shopper
    )
    assert r.status_code == 422
    assert await current(client, shopper) == [ln(1, 10, 1)]  # all or nothing


async def test_a_cart_cannot_grow_past_100_different_offers(client, shopper):
    await put(client, shopper, [ln(1, i, 1) for i in range(99)])
    r = await client.post(MERGE, json={"lines": [ln(1, 500, 1), ln(1, 501, 1)]}, headers=shopper)
    assert r.status_code == 409 and r.json()["error"]["code"] == "cart_full"
    assert len(await current(client, shopper)) == 99  # rolled back, not half merged


async def test_merging_does_not_touch_anyone_elses_cart(client):
    alice, _ = await headers_for("alice@shop.example")
    bob, _ = await headers_for("bob@shop.example")
    await put(client, alice, [ln(1, 10, 1)])
    await client.post(MERGE, json={"lines": [ln(1, 10, 9)]}, headers=bob)
    assert await current(client, alice) == [ln(1, 10, 1)]
    assert await current(client, bob) == [ln(1, 10, 9)]


# ---------------------------------------------------------------- concurrency


async def test_simultaneous_saves_never_fail_and_leave_one_whole_cart(client, shopper):
    variants = [[ln(1, 10 + i, 1 + i), ln(2, 20 + i, 2 + i)] for i in range(6)]
    results = await asyncio.gather(*(put(client, shopper, v) for v in variants))
    assert all(r.status_code == 200 for r in results)  # no integrity error, no deadlock
    assert await current(client, shopper) in variants  # exactly one save won, nothing mixed
    async with SessionLocal() as db:
        assert (await db.execute(select(func.count(Cart.id)))).scalar_one() == 1


async def test_simultaneous_first_saves_create_one_cart(client, shopper):
    results = await asyncio.gather(
        *(client.post(MERGE, json={"lines": [ln(1, 10, 1)]}, headers=shopper) for _ in range(5))
    )
    assert all(r.status_code == 200 for r in results)
    assert await current(client, shopper) == [ln(1, 10, 5)]  # five merges, bundles added together
    async with SessionLocal() as db:
        assert (await db.execute(select(func.count(Cart.id)))).scalar_one() == 1


# ------------------------------------------------------------- database rules


async def test_the_database_itself_refuses_a_bad_bundle_count_and_a_duplicate_offer(shopper):
    from sqlalchemy.exc import IntegrityError

    async with SessionLocal() as db:
        user = (await db.execute(select(User))).scalars().first()
        cart = Cart(user_id=user.id)
        db.add(cart)
        await db.flush()
        for bad in (0, 100):
            with pytest.raises(IntegrityError):
                async with db.begin_nested():
                    db.add(CartItem(cart_id=cart.id, product_id=1, tier_id=1, bundles=bad))
                    await db.flush()
        db.add(CartItem(cart_id=cart.id, product_id=1, tier_id=1, bundles=1))
        await db.flush()
        with pytest.raises(IntegrityError):
            async with db.begin_nested():
                db.add(CartItem(cart_id=cart.id, product_id=2, tier_id=1, bundles=1))
                await db.flush()


async def test_deleting_an_account_deletes_its_cart(client):
    headers, user = await headers_for("gone@shop.example")
    await put(client, headers, [ln(1, 10, 1)])
    async with SessionLocal() as db:
        await db.execute(delete(User).where(User.id == user.id))
        await db.commit()
        assert (await db.execute(select(func.count(Cart.id)))).scalar_one() == 0
        assert (await db.execute(select(func.count(CartItem.id)))).scalar_one() == 0


async def test_tier_and_product_ids_are_not_foreign_keys(shopper):
    """On purpose: a deleted offer must not make the line vanish (see CartItem)."""
    async with SessionLocal() as db:
        foreign = (
            (
                await db.execute(
                    text(
                        "SELECT kcu.column_name FROM information_schema.table_constraints tc "
                        "JOIN information_schema.key_column_usage kcu USING (constraint_name) "
                        "WHERE tc.table_name = 'cart_items' AND tc.constraint_type = 'FOREIGN KEY'"
                    )
                )
            )
            .scalars()
            .all()
        )
    assert foreign == ["cart_id"]


# ------------------------------------------- an idempotent merge (a lost response is retried)


async def merge(client, headers, lines, merge_id=None):
    body = {"lines": lines}
    if merge_id is not None:
        body["merge_id"] = merge_id
    return await client.post(MERGE, json=body, headers=headers)


async def test_repeating_the_same_merge_does_not_add_the_bundles_twice(client, shopper):
    """The browser merged, never heard the answer, and tries again with the same id."""
    first = await merge(client, shopper, [ln(1, 10, 2)], "guest-cart-0001")
    again = await merge(client, shopper, [ln(1, 10, 2)], "guest-cart-0001")
    assert first.json()["lines"] == [ln(1, 10, 2)]
    assert again.status_code == 200
    assert again.json()["lines"] == [ln(1, 10, 2)]  # 2, not 4
    assert await current(client, shopper) == [ln(1, 10, 2)]


async def test_a_repeated_merge_returns_the_cart_as_it_is_now(client, shopper):
    await merge(client, shopper, [ln(1, 10, 2)], "guest-cart-0001")
    await put(client, shopper, [ln(1, 10, 5), ln(2, 20, 1)])  # the customer kept shopping
    again = await merge(client, shopper, [ln(1, 10, 2)], "guest-cart-0001")
    assert again.json()["lines"] == [ln(1, 10, 5), ln(2, 20, 1)]  # untouched by the replay


async def test_a_different_merge_id_is_a_new_merge(client, shopper):
    await merge(client, shopper, [ln(1, 10, 2)], "guest-cart-0001")
    second = await merge(client, shopper, [ln(1, 10, 3)], "guest-cart-0002")
    assert second.json()["lines"] == [ln(1, 10, 5)]


async def test_without_a_merge_id_every_merge_adds(client, shopper):
    await merge(client, shopper, [ln(1, 10, 2)])
    again = await merge(client, shopper, [ln(1, 10, 2)])
    assert again.json()["lines"] == [ln(1, 10, 4)]  # the old behaviour, for callers that send no id


async def test_the_same_merge_id_for_two_people_is_two_merges(client):
    alice, _ = await headers_for("alice@shop.example")
    bob, _ = await headers_for("bob@shop.example")
    await merge(client, alice, [ln(1, 10, 1)], "guest-cart-0001")
    other = await merge(client, bob, [ln(1, 10, 7)], "guest-cart-0001")
    assert other.json()["lines"] == [ln(1, 10, 7)]  # ids are per cart, not global


async def test_a_failed_merge_does_not_use_up_its_id(client, shopper):
    await put(client, shopper, [ln(1, i, 1) for i in range(99)])
    full = await merge(client, shopper, [ln(1, 500, 1), ln(1, 501, 1)], "guest-cart-0001")
    assert full.status_code == 409
    await put(client, shopper, [ln(1, 0, 1)])  # room again
    retry = await merge(client, shopper, [ln(1, 500, 1), ln(1, 501, 1)], "guest-cart-0001")
    assert retry.status_code == 200 and len(retry.json()["lines"]) == 3  # the retry really merged


async def test_simultaneous_repeats_of_one_merge_add_the_bundles_once(client, shopper):
    results = await asyncio.gather(
        *(merge(client, shopper, [ln(1, 10, 2)], "guest-cart-0001") for _ in range(6))
    )
    assert all(r.status_code == 200 for r in results)
    assert await current(client, shopper) == [ln(1, 10, 2)]


@pytest.mark.parametrize("bad", ["short", "has spaces here", "x" * 65, "bad;id-12345", ""])
async def test_a_malformed_merge_id_is_rejected(client, shopper, bad):
    r = await merge(client, shopper, [ln(1, 10, 1)], bad)
    assert r.status_code == 422 and "merge_id" in r.json()["error"]["fields"]
    assert await current(client, shopper) == []


async def test_the_merge_id_is_stored_with_the_cart(shopper):
    from sqlalchemy import select

    async with SessionLocal() as db:
        user = (await db.execute(select(User))).scalars().first()
    # saving through the service sets it; here we check the column exists and is nullable
    async with SessionLocal() as db:
        cart = Cart(user_id=user.id)
        db.add(cart)
        await db.flush()
        assert cart.last_merge_id is None
        cart.last_merge_id = "guest-cart-0001"
        await db.flush()
