import pytest

from tests.factories import make_brand, make_category, make_product

KINDS = [("brands", "brand"), ("categories", "category")]


@pytest.mark.parametrize(("path", "kind"), KINDS)
async def test_guest_and_customer_cannot_use_admin_routes(client, customer_headers, path, kind):
    assert (await client.get(f"/api/v1/admin/{path}")).status_code == 401
    r = await client.get(f"/api/v1/admin/{path}", headers=customer_headers)
    assert r.status_code == 403
    assert (
        await client.post(f"/api/v1/admin/{path}", json={"name": "X"}, headers=customer_headers)
    ).status_code == 403


@pytest.mark.parametrize(("path", "kind"), KINDS)
async def test_create_list_update_delete(client, admin_headers, path, kind):
    url = f"/api/v1/admin/{path}"
    r = await client.post(url, json={"name": "  Alpha  ", "name_ar": "ألفا"}, headers=admin_headers)
    assert r.status_code == 201
    item = r.json()
    assert item["name"] == "Alpha" and item["name_ar"] == "ألفا" and item["product_count"] == 0

    r = await client.put(
        f"{url}/{item['id']}", json={"name": "Alpha 2", "name_ar": "   "}, headers=admin_headers
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Alpha 2" and r.json()["name_ar"] is None  # blank Arabic -> null

    listed = (await client.get(url, headers=admin_headers)).json()
    assert [i["name"] for i in listed] == ["Alpha 2"]

    assert (await client.delete(f"{url}/{item['id']}", headers=admin_headers)).status_code == 204
    assert (await client.get(url, headers=admin_headers)).json() == []


@pytest.mark.parametrize(("path", "kind"), KINDS)
async def test_names_are_unique_ignoring_case(client, admin_headers, path, kind):
    url = f"/api/v1/admin/{path}"
    await client.post(url, json={"name": "Alpha"}, headers=admin_headers)
    r = await client.post(url, json={"name": " ALPHA "}, headers=admin_headers)
    assert r.status_code == 409 and r.json()["error"]["code"] == "duplicate_name"
    assert "name" in r.json()["error"]["fields"]

    other = (await client.post(url, json={"name": "Beta"}, headers=admin_headers)).json()
    r = await client.put(f"{url}/{other['id']}", json={"name": "alpha"}, headers=admin_headers)
    assert r.status_code == 409
    # renaming to its own name (different case) is allowed
    r = await client.put(f"{url}/{other['id']}", json={"name": "BETA"}, headers=admin_headers)
    assert r.status_code == 200


@pytest.mark.parametrize(("path", "kind"), KINDS)
async def test_name_validation(client, admin_headers, path, kind):
    url = f"/api/v1/admin/{path}"
    for body in ({"name": ""}, {"name": "   "}, {"name": "x" * 101}, {}):
        r = await client.post(url, json=body, headers=admin_headers)
        assert r.status_code == 422 and "name" in r.json()["error"]["fields"]


@pytest.mark.parametrize(("path", "kind"), KINDS)
async def test_unknown_id_is_404(client, admin_headers, path, kind):
    url = f"/api/v1/admin/{path}/999"
    assert (await client.put(url, json={"name": "X"}, headers=admin_headers)).status_code == 404
    assert (await client.delete(url, headers=admin_headers)).status_code == 404


async def test_brand_in_use_cannot_be_deleted_and_message_has_the_count(client, admin_headers):
    brand, category = await make_brand("Used"), await make_category()
    await make_product(brand, category, name="One")
    await make_product(brand, category, name="Two (inactive)", is_active=False, tiers=())
    r = await client.delete(f"/api/v1/admin/brands/{brand}", headers=admin_headers)
    assert r.status_code == 409
    error = r.json()["error"]
    assert error["code"] == "brand_in_use" and error["params"] == {"count": 2}
    assert error["message"] == "2 products use this brand"  # inactive products count too
    assert (await client.get("/api/v1/admin/brands", headers=admin_headers)).json()[0][
        "product_count"
    ] == 2


async def test_category_in_use_singular_message(client, admin_headers):
    brand, category = await make_brand(), await make_category("Used")
    await make_product(brand, category)
    r = await client.delete(f"/api/v1/admin/categories/{category}", headers=admin_headers)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "category_in_use"
    assert r.json()["error"]["message"] == "1 product uses this category"


async def test_unused_brand_can_be_deleted_after_its_products_are_gone(client, admin_headers):
    brand, category = await make_brand(), await make_category()
    product = await make_product(brand, category)
    assert (
        await client.delete(f"/api/v1/admin/brands/{brand}", headers=admin_headers)
    ).status_code == 409
    await client.delete(f"/api/v1/admin/products/{product}", headers=admin_headers)
    assert (
        await client.delete(f"/api/v1/admin/brands/{brand}", headers=admin_headers)
    ).status_code == 204


async def test_display_name_follows_the_language_with_fallback(client, admin_headers):
    await make_brand("With Arabic", "بالعربية")
    await make_brand("English only")
    ar = {**admin_headers, "Accept-Language": "ar"}
    names = {
        i["name"]: i["display_name"]
        for i in (await client.get("/api/v1/admin/brands", headers=ar)).json()
    }
    assert names == {"With Arabic": "بالعربية", "English only": "English only"}
    en = (await client.get("/api/v1/admin/brands", headers=admin_headers)).json()
    assert {i["display_name"] for i in en} == {"With Arabic", "English only"}
