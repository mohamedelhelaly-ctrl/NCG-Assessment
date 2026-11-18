import pytest

from tests.factories import make_brand, make_category, make_product

P = "/api/v1/products"
AR = {"Accept-Language": "ar"}


@pytest.fixture
async def world():
    """Two brands, two categories and a mix of visible and hidden products."""
    nova = await make_brand("Nova Health", "نوفا هيلث")
    pure = await make_brand("PureCare")
    wound = await make_category("Wound Care", "العناية بالجروح")
    vit = await make_category("Vitamins")
    ids = {
        "a": await make_product(
            nova, wound, "Gauze Pads", "ضمادات شاش", tiers=((1, 3250),), images=2
        ),
        "b": await make_product(pure, wound, "Bandage Strips", None, tiers=((4, 9900), (1, 2750))),
        "c": await make_product(
            nova, vit, "Vitamin C", "فيتامين سي", tiers=((12, 55000), (1, 5500), (4, 19500))
        ),
        "inactive": await make_product(pure, vit, "Hidden Inactive", is_active=False),
        "no_tiers": await make_product(nova, vit, "Hidden No Tiers", tiers=()),
    }
    return {"nova": nova, "pure": pure, "wound": wound, "vit": vit, **ids}


async def names(client, **params):
    headers = params.pop("headers", None)
    r = await client.get(P, params=params, headers=headers)
    assert r.status_code == 200, r.text
    return sorted(i["name"] for i in r.json()["items"])


async def test_only_visible_products_are_listed(client, world):
    assert await names(client) == ["Bandage Strips", "Gauze Pads", "Vitamin C"]


async def test_cards_show_all_tiers_ordered_by_units_with_exact_prices(client, world):
    items = {i["name"]: i for i in (await client.get(P)).json()["items"]}
    assert [(t["units"], t["price_fils"]) for t in items["Gauze Pads"]["tiers"]] == [(1, 3250)]
    assert [(t["units"], t["price_fils"]) for t in items["Bandage Strips"]["tiers"]] == [
        (1, 2750),
        (4, 9900),
    ]
    assert [(t["units"], t["price_fils"]) for t in items["Vitamin C"]["tiers"]] == [
        (1, 5500),
        (4, 19500),
        (12, 55000),
    ]  # the one, two and three option products from the brief


async def test_card_has_brand_category_and_main_image(client, world):
    card = {i["name"]: i for i in (await client.get(P)).json()["items"]}["Gauze Pads"]
    assert card["brand"]["name"] == "Nova Health" and card["category"]["name"] == "Wound Care"
    assert card["main_image"]["url"].endswith("img0.webp")
    assert {i["name"]: i["main_image"] for i in (await client.get(P)).json()["items"]}[
        "Vitamin C"
    ] is None


async def test_filters_combine(client, world):
    assert await names(client, brand_id=world["nova"]) == ["Gauze Pads", "Vitamin C"]
    assert await names(client, category_id=world["wound"]) == ["Bandage Strips", "Gauze Pads"]
    assert await names(client, brand_id=world["nova"], category_id=world["wound"]) == ["Gauze Pads"]
    assert (
        await names(client, brand_id=world["pure"], category_id=world["vit"]) == []
    )  # only hidden ones


@pytest.mark.parametrize(
    ("term", "expected"),
    [
        ("gauze", ["Gauze Pads"]),  # product name, case-insensitive
        ("VITAMIN", ["Vitamin C"]),
        ("purecare", ["Bandage Strips"]),  # brand name
        ("wound", ["Bandage Strips", "Gauze Pads"]),  # category name
        ("نوفا", ["Gauze Pads", "Vitamin C"]),  # Arabic brand name
        ("فيتامين", ["Vitamin C"]),  # Arabic product name
        ("العناية", ["Bandage Strips", "Gauze Pads"]),  # Arabic category name
        ("hidden", []),
        ("nothing matches", []),
    ],
)
async def test_search_matches_product_brand_or_category_in_both_languages(
    client, world, term, expected
):
    # the same results in either view: Arabic names are searchable from the English view and back
    assert await names(client, search=term) == expected
    assert await names(client, search=term, headers=AR) == sorted(
        {"Gauze Pads": "ضمادات شاش", "Vitamin C": "فيتامين سي", "Bandage Strips": "Bandage Strips"}[
            n
        ]
        for n in expected
    )


async def test_search_combines_with_filters_and_escapes_wildcards(client, world):
    assert await names(client, search="a", brand_id=world["pure"]) == ["Bandage Strips"]
    assert await names(client, search="%") == []  # a literal percent sign, not "match everything"
    assert await names(client, search="_") == []
    assert await names(client, search="   ") == ["Bandage Strips", "Gauze Pads", "Vitamin C"]


async def test_pagination_envelope_order_and_limits(client, world):
    first = (await client.get(P, params={"page_size": 2})).json()
    assert (first["total"], first["page"], first["page_size"], first["total_pages"]) == (3, 1, 2, 2)
    second = (await client.get(P, params={"page": 2, "page_size": 2})).json()
    ids = [i["id"] for i in first["items"] + second["items"]]
    assert ids == sorted(ids, reverse=True) and len(set(ids)) == 3
    assert (await client.get(P, params={"page": 3, "page_size": 2})).json()["items"] == []
    assert (await client.get(P, params={"page_size": 49})).status_code == 422
    assert (await client.get(P, params={"page": 0})).status_code == 422
    empty = (await client.get(P, params={"search": "zzz"})).json()
    assert (empty["total"], empty["total_pages"]) == (0, 1)


async def test_detail_includes_gallery_and_all_tiers(client, world):
    r = await client.get(f"{P}/{world['a']}")
    assert r.status_code == 200
    body = r.json()
    assert len(body["images"]) == 2 and body["main_image"] == body["images"][0]
    assert body["description"] == "A product"


async def test_hidden_products_are_404_on_the_public_detail(client, world):
    for key in ("inactive", "no_tiers"):
        assert (await client.get(f"{P}/{world[key]}")).status_code == 404
    assert (await client.get(f"{P}/9999")).status_code == 404
    assert (await client.get(f"{P}/abc")).status_code == 422


async def test_language_is_resolved_per_field_with_english_fallback(client, world):
    en = (await client.get(f"{P}/{world['a']}")).json()
    ar = (await client.get(f"{P}/{world['a']}", headers=AR)).json()
    assert en["name"] == "Gauze Pads" and ar["name"] == "ضمادات شاش"
    assert ar["brand"]["name"] == "نوفا هيلث" and ar["category"]["name"] == "العناية بالجروح"
    assert ar["description"] == "A product"  # no Arabic description: English fallback, per field
    assert ar["tiers"][0]["label"] == "1 عبوة"
    assert ar["images"][0]["alt"] == "ضمادات شاش 0" and en["images"][0]["alt"] == "Gauze Pads 0"
    # a product with no Arabic at all shows English in the Arabic view
    b = (await client.get(f"{P}/{world['b']}", headers=AR)).json()
    assert b["name"] == "Bandage Strips" and b["brand"]["name"] == "PureCare"


async def test_responses_vary_by_language(client, world):
    assert "Accept-Language" in (await client.get(P)).headers["vary"]
    assert "Accept-Language" in (await client.get(f"{P}/{world['a']}")).headers["vary"]


async def test_brand_and_category_lists_count_only_visible_products(client, world):
    brands = {b["name"]: b["product_count"] for b in (await client.get("/api/v1/brands")).json()}
    assert brands == {"Nova Health": 2, "PureCare": 1}  # hidden products are not counted
    cats = {c["name"]: c["product_count"] for c in (await client.get("/api/v1/categories")).json()}
    assert cats == {"Wound Care": 2, "Vitamins": 1}


async def test_brands_and_categories_without_visible_products_are_not_listed(client):
    brand, category = await make_brand("Empty Brand"), await make_category("Empty Category")
    await make_product(brand, category, is_active=False)
    assert (await client.get("/api/v1/brands")).json() == []
    assert (await client.get("/api/v1/categories")).json() == []


async def test_brand_and_category_lists_follow_the_language_and_sort_by_displayed_name(client):
    zed = await make_brand("Alpha", "ياء")
    abc = await make_brand("Beta", "ألف")
    cat = await make_category("Z cat")
    await make_product(zed, cat, "P1")
    await make_product(abc, cat, "P2")
    en = [b["name"] for b in (await client.get("/api/v1/brands")).json()]
    ar = [b["name"] for b in (await client.get("/api/v1/brands", headers=AR)).json()]
    assert en == ["Alpha", "Beta"] and ar == ["ألف", "ياء"]


async def test_catalog_is_public_and_needs_no_token(client, world):
    for path in (P, f"{P}/{world['a']}", "/api/v1/brands", "/api/v1/categories"):
        assert (await client.get(path)).status_code == 200


async def test_admin_edits_show_on_the_storefront(client, admin_headers, world):
    """The end-to-end promise of the brief: change something in admin, see it in the store."""
    detail = (
        await client.get(f"/api/v1/admin/products/{world['a']}", headers=admin_headers)
    ).json()
    r = await client.put(
        f"/api/v1/admin/products/{world['a']}",
        json={
            **{k: detail[k] for k in ("brand_id", "category_id", "description", "is_active")},
            "name": "Renamed Gauze",
            "name_ar": None,
        },
        headers=admin_headers,
    )
    assert r.status_code == 200
    assert "Renamed Gauze" in await names(client)
    await client.post(
        f"/api/v1/admin/products/{world['a']}/tiers",
        json={"label": "4 packs", "units": 4, "price_fils": 11000},
        headers=admin_headers,
    )
    card = {i["name"]: i for i in (await client.get(P)).json()["items"]}["Renamed Gauze"]
    assert [t["units"] for t in card["tiers"]] == [1, 4]
