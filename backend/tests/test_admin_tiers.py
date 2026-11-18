import pytest

from tests.factories import make_brand, make_category, make_product

URL = "/api/v1/admin"


@pytest.fixture
async def product():
    return await make_product(await make_brand(), await make_category(), tiers=((1, 5500),))


def tier(units=4, price=19500, **over):
    return {"label": f"{units} packs", "units": units, "price_fils": price, **over}


async def test_add_edit_and_delete_a_tier(client, admin_headers, product):
    r = await client.post(f"{URL}/products/{product}/tiers", json=tier(), headers=admin_headers)
    assert r.status_code == 201
    created = r.json()
    assert (created["units"], created["price_fils"]) == (4, 19500)

    r = await client.put(
        f"{URL}/tiers/{created['id']}",
        json=tier(units=6, price=27000, label_ar="6 عبوات"),
        headers=admin_headers,
    )
    assert r.status_code == 200
    assert (r.json()["units"], r.json()["price_fils"], r.json()["label_ar"]) == (
        6,
        27000,
        "6 عبوات",
    )

    r = await client.delete(f"{URL}/tiers/{created['id']}", headers=admin_headers)
    assert r.status_code == 200 and r.json() == {"product_deactivated": False}
    detail = (await client.get(f"{URL}/products/{product}", headers=admin_headers)).json()
    assert [t["units"] for t in detail["tiers"]] == [1]


async def test_the_number_of_tiers_is_not_fixed(client, admin_headers, product):
    for units in (2, 3, 4, 6, 12, 24):
        r = await client.post(
            f"{URL}/products/{product}/tiers", json=tier(units, units * 1000), headers=admin_headers
        )
        assert r.status_code == 201
    detail = (await client.get(f"{URL}/products/{product}", headers=admin_headers)).json()
    assert [t["units"] for t in detail["tiers"]] == [1, 2, 3, 4, 6, 12, 24]  # ordered by units


@pytest.mark.parametrize(
    ("bad", "field"),
    [
        ({"units": 0}, "units"),
        ({"units": -4}, "units"),
        ({"units": 2.5}, "units"),
        ({"price_fils": 0}, "price_fils"),
        ({"price_fils": -1}, "price_fils"),
        ({"price_fils": 1_000_000_001}, "price_fils"),
        ({"price_fils": 19.5}, "price_fils"),
        ({"label": " "}, "label"),
    ],
)
async def test_tier_validation(client, admin_headers, product, bad, field):
    r = await client.post(
        f"{URL}/products/{product}/tiers", json=tier(**bad), headers=admin_headers
    )
    assert r.status_code == 422 and field in r.json()["error"]["fields"]


async def test_duplicate_units_are_rejected_on_add_and_edit(client, admin_headers, product):
    r = await client.post(
        f"{URL}/products/{product}/tiers", json=tier(units=1), headers=admin_headers
    )
    assert r.status_code == 409 and r.json()["error"]["code"] == "duplicate_units"
    assert "units" in r.json()["error"]["fields"]

    four = (
        await client.post(f"{URL}/products/{product}/tiers", json=tier(), headers=admin_headers)
    ).json()
    r = await client.put(f"{URL}/tiers/{four['id']}", json=tier(units=1), headers=admin_headers)
    assert r.status_code == 409
    # keeping its own units while changing the price is fine
    r = await client.put(
        f"{URL}/tiers/{four['id']}", json=tier(units=4, price=18000), headers=admin_headers
    )
    assert r.status_code == 200


async def test_the_same_units_are_allowed_on_different_products(client, admin_headers, product):
    other = await make_product(await make_brand("B2"), await make_category("C2"), tiers=())
    r = await client.post(
        f"{URL}/products/{other}/tiers", json=tier(units=1), headers=admin_headers
    )
    assert r.status_code == 201


async def test_deleting_the_last_tier_of_an_active_product_deactivates_it(
    client, admin_headers, product
):
    detail = (await client.get(f"{URL}/products/{product}", headers=admin_headers)).json()
    assert detail["is_active"] is True
    r = await client.delete(f"{URL}/tiers/{detail['tiers'][0]['id']}", headers=admin_headers)
    assert r.json() == {"product_deactivated": True}
    detail = (await client.get(f"{URL}/products/{product}", headers=admin_headers)).json()
    assert detail["is_active"] is False and detail["tiers"] == []
    assert (await client.get(f"/api/v1/products/{product}")).status_code == 404  # hidden publicly


async def test_unknown_ids_are_404_and_guards_apply(
    client, admin_headers, customer_headers, product
):
    assert (
        await client.post(f"{URL}/products/999/tiers", json=tier(), headers=admin_headers)
    ).status_code == 404
    assert (
        await client.put(f"{URL}/tiers/999", json=tier(), headers=admin_headers)
    ).status_code == 404
    assert (await client.delete(f"{URL}/tiers/999", headers=admin_headers)).status_code == 404
    assert (await client.post(f"{URL}/products/{product}/tiers", json=tier())).status_code == 401
    assert (
        await client.post(f"{URL}/products/{product}/tiers", json=tier(), headers=customer_headers)
    ).status_code == 403


async def test_price_is_stored_exactly(client, admin_headers, product):
    r = await client.post(
        f"{URL}/products/{product}/tiers", json=tier(12, 55000), headers=admin_headers
    )
    assert r.json()["price_fils"] == 55000  # integer fils, no float rounding
