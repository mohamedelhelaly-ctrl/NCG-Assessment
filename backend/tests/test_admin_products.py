import pytest

from tests.factories import make_brand, make_category, make_product

URL = "/api/v1/admin/products"


@pytest.fixture
async def refs():
    return await make_brand("Nova Health", "نوفا"), await make_category("Wound Care", "العناية")


def body(refs, **over):
    brand, category = refs
    return {
        "brand_id": brand,
        "category_id": category,
        "name": "Sterile Gauze",
        "description": "Soft pads",
        **over,
    }


async def test_guest_and_customer_are_refused(client, customer_headers, refs):
    assert (await client.get(URL)).status_code == 401
    assert (await client.post(URL, json=body(refs), headers=customer_headers)).status_code == 403
    assert (await client.get(f"{URL}/1", headers=customer_headers)).status_code == 403
    assert (await client.delete(f"{URL}/1", headers=customer_headers)).status_code == 403


async def test_create_with_nested_tiers_returns_both_languages(client, admin_headers, refs):
    r = await client.post(
        URL,
        headers=admin_headers,
        json=body(
            refs,
            name_ar="شاش",
            description_ar="   ",
            is_active=True,
            tiers=[
                {"label": "4 packs", "label_ar": "4 عبوات", "units": 4, "price_fils": 19500},
                {"label": "1 pack", "units": 1, "price_fils": 5500},
            ],
        ),
    )
    assert r.status_code == 201
    product = r.json()
    assert product["name_ar"] == "شاش" and product["description_ar"] is None
    assert [(t["units"], t["price_fils"]) for t in product["tiers"]] == [(1, 5500), (4, 19500)]
    assert product["tiers"][0]["label_ar"] is None
    assert product["is_active"] is True and product["images"] == []


async def test_a_product_is_inactive_by_default(client, admin_headers, refs):
    product = (await client.post(URL, json=body(refs), headers=admin_headers)).json()
    assert product["is_active"] is False and product["tiers"] == []


async def test_cannot_create_or_activate_a_product_without_tiers(client, admin_headers, refs):
    r = await client.post(URL, json=body(refs, is_active=True), headers=admin_headers)
    assert r.status_code == 409 and r.json()["error"]["code"] == "product_needs_tier"

    product = (await client.post(URL, json=body(refs), headers=admin_headers)).json()
    r = await client.put(
        f"{URL}/{product['id']}", json=body(refs, is_active=True), headers=admin_headers
    )
    assert r.status_code == 409 and r.json()["error"]["code"] == "product_needs_tier"

    await client.post(
        f"{URL}/{product['id']}/tiers",
        json={"label": "1 pack", "units": 1, "price_fils": 1000},
        headers=admin_headers,
    )
    r = await client.put(
        f"{URL}/{product['id']}", json=body(refs, is_active=True), headers=admin_headers
    )
    assert r.status_code == 200 and r.json()["is_active"] is True


async def test_nested_tiers_with_the_same_units_are_rejected(client, admin_headers, refs):
    tiers = [
        {"label": "a", "units": 4, "price_fils": 1000},
        {"label": "b", "units": 4, "price_fils": 2000},
    ]
    r = await client.post(URL, json=body(refs, tiers=tiers), headers=admin_headers)
    assert r.status_code == 422 and "tiers" in r.json()["error"]["fields"]


async def test_unknown_brand_or_category_is_a_field_error(client, admin_headers, refs):
    r = await client.post(
        URL, json={**body(refs), "brand_id": 999, "category_id": 998}, headers=admin_headers
    )
    assert r.status_code == 422
    assert set(r.json()["error"]["fields"]) == {"brand_id", "category_id"}


@pytest.mark.parametrize(
    "bad",
    [{"name": ""}, {"name": "x" * 201}, {"description": "  "}, {"name_ar": "x" * 201}],
)
async def test_product_validation(client, admin_headers, refs, bad):
    r = await client.post(URL, json=body(refs, **bad), headers=admin_headers)
    assert r.status_code == 422 and r.json()["error"]["code"] == "validation_error"


async def test_update_changes_fields_and_keeps_tiers(client, admin_headers, refs):
    brand2 = await make_brand("PureCare")
    created = (
        await client.post(
            URL,
            headers=admin_headers,
            json=body(refs, tiers=[{"label": "1", "units": 1, "price_fils": 1000}]),
        )
    ).json()
    r = await client.put(
        f"{URL}/{created['id']}",
        json={**body(refs), "brand_id": brand2, "name": "Renamed", "name_ar": "جديد"},
        headers=admin_headers,
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Renamed" and r.json()["brand_id"] == brand2
    assert len(r.json()["tiers"]) == 1
    fetched = (await client.get(f"{URL}/{created['id']}", headers=admin_headers)).json()
    assert fetched["name_ar"] == "جديد"  # persisted


async def test_unknown_product_is_404(client, admin_headers, refs):
    assert (await client.get(f"{URL}/999", headers=admin_headers)).status_code == 404
    assert (
        await client.put(f"{URL}/999", json=body(refs), headers=admin_headers)
    ).status_code == 404
    assert (await client.delete(f"{URL}/999", headers=admin_headers)).status_code == 404


async def test_delete_removes_tiers_and_images_and_stored_files(
    client, admin_headers, refs, storage
):
    created = (
        await client.post(
            URL,
            headers=admin_headers,
            json=body(refs, tiers=[{"label": "1", "units": 1, "price_fils": 1000}]),
        )
    ).json()
    from tests.test_admin_images import png

    up = await client.post(
        f"{URL}/{created['id']}/images",
        files={"file": ("a.png", png(), "image/png")},
        data={"alt": "front"},
        headers=admin_headers,
    )
    assert up.status_code == 201 and len(storage.files) == 1
    assert (await client.delete(f"{URL}/{created['id']}", headers=admin_headers)).status_code == 204
    assert storage.files == {}
    assert (await client.get(f"{URL}/{created['id']}", headers=admin_headers)).status_code == 404
    from sqlalchemy import func, select

    from app.database import SessionLocal
    from app.models.pricing_tier import PricingTier
    from app.models.product_image import ProductImage

    async with SessionLocal() as db:
        assert (await db.execute(select(func.count(PricingTier.id)))).scalar_one() == 0
        assert (await db.execute(select(func.count(ProductImage.id)))).scalar_one() == 0


async def test_list_includes_inactive_and_tierless_products_with_flags(client, admin_headers, refs):
    brand, category = refs
    await make_product(brand, category, name="Visible", name_ar="ظاهر")
    await make_product(brand, category, name="Draft", is_active=False, tiers=())
    await make_product(brand, category, name="Inactive with tier", is_active=False)
    page = (await client.get(URL, headers=admin_headers)).json()
    assert page["total"] == 3
    by_name = {i["name"]: i for i in page["items"]}
    assert by_name["Draft"]["tier_count"] == 0 and by_name["Draft"]["is_active"] is False
    assert by_name["Draft"]["missing_ar"] is True and by_name["Visible"]["missing_ar"] is False
    assert by_name["Visible"]["brand"] == "Nova Health"


async def test_list_filters(client, admin_headers, refs):
    brand, category = refs
    other_brand = await make_brand("PureCare")
    other_cat = await make_category("Vitamins")
    await make_product(brand, category, name="Gauze Pads", name_ar="شاش")
    await make_product(other_brand, other_cat, name="Vitamin C", is_active=False)
    await make_product(brand, other_cat, name="Draft", is_active=False, tiers=())

    def names(page):
        return sorted(i["name"] for i in page["items"])

    async def get(**params):
        return (await client.get(URL, params=params, headers=admin_headers)).json()

    assert names(await get(brand_id=brand)) == ["Draft", "Gauze Pads"]
    assert names(await get(category_id=other_cat)) == ["Draft", "Vitamin C"]
    assert names(await get(brand_id=brand, category_id=other_cat)) == ["Draft"]
    assert names(await get(status="active")) == ["Gauze Pads"]
    assert names(await get(status="inactive")) == ["Draft", "Vitamin C"]
    assert names(await get(status="no_tiers")) == ["Draft"]
    assert names(await get(missing_ar="true")) == ["Draft", "Vitamin C"]
    assert names(await get(search="vitamin")) == ["Draft", "Vitamin C"]  # category name matches too
    assert names(await get(search="vitamin c")) == ["Vitamin C"]
    assert names(await get(search="شاش")) == ["Gauze Pads"]  # Arabic search
    assert names(await get(search="purecare")) == ["Vitamin C"]  # brand name
    assert (
        await client.get(URL, params={"status": "bogus"}, headers=admin_headers)
    ).status_code == 422


async def test_list_pagination_envelope_and_stable_order(client, admin_headers, refs):
    brand, category = refs
    for i in range(5):
        await make_product(brand, category, name=f"P{i}")
    first = (await client.get(URL, params={"page_size": 2}, headers=admin_headers)).json()
    assert (first["total"], first["page"], first["page_size"], first["total_pages"]) == (5, 1, 2, 3)
    pages = [
        (await client.get(URL, params={"page": p, "page_size": 2}, headers=admin_headers)).json()
        for p in (1, 2, 3)
    ]
    ids = [i["id"] for page in pages for i in page["items"]]
    assert len(ids) == 5 and len(set(ids)) == 5  # no overlaps, nothing missing
    assert ids == sorted(ids, reverse=True)  # newest first, ties broken by id
    assert (
        await client.get(URL, params={"page_size": 101}, headers=admin_headers)
    ).status_code == 422
