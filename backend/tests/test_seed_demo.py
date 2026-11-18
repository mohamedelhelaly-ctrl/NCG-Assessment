from sqlalchemy import func, select

from app.config import get_settings
from app.database import SessionLocal
from app.models.brand import Brand
from app.models.category import Category
from app.models.product import Product
from scripts.seed_demo import (
    DEMO_EMAIL,
    PRODUCTS,
    placeholder_svg,
    seed_catalog,
    seed_customer,
)
from tests.factories import make_brand, make_category, make_product

URL = "/api/v1/products"

# name -> [(packs, fils)] exactly as supplied for the demo catalog
EXPECTED = {
    "Nitrile Examination Gloves": [(1, 5500), (4, 19500), (12, 55000)],
    "Disposable Medical Face Masks": [(1, 2250), (4, 8000), (12, 22500)],
    "Disposable Syringes (5ml)": [(1, 3000), (4, 10500)],
    "Disposable IV Sets": [(1, 4250), (10, 38000)],
    "Digital Thermometers": [(1, 6750)],
    "Digital Blood Pressure Monitors": [(1, 24500)],
    "Fingertip Pulse Oximeters": [(1, 12500), (2, 23000)],
    "Digital Weighing Scales": [(1, 15750)],
    "Sterile Gauze Pads": [(1, 1750), (4, 6250), (12, 18000)],
    "Medical Adhesive Tape": [(1, 1250), (6, 6500)],
    "Adhesive Bandages": [(1, 1500), (5, 6500), (20, 22000)],
    "Elastic Crepe Bandages": [(1, 2250)],
}


async def listing(client):
    page = (await client.get(URL, params={"page_size": 48})).json()
    return {i["name"]: i for i in page["items"]}


async def test_seed_creates_the_twelve_products_with_their_exact_tiers_and_prices(client, storage):
    assert (await seed_catalog(storage)).startswith("created")
    items = await listing(client)
    assert set(items) == set(EXPECTED)
    for name, expected in EXPECTED.items():
        assert [(t["units"], t["price_fils"]) for t in items[name]["tiers"]] == expected, name
    counts = sorted(len(i["tiers"]) for i in items.values())
    assert counts == [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3]


async def test_seed_covers_one_two_and_three_option_products(client, storage):
    await seed_catalog(storage)
    sizes = {len(i["tiers"]) for i in (await listing(client)).values()}
    assert sizes == {1, 2, 3}  # the brief's one, two and three option products


async def test_seed_has_four_brands_and_three_categories_with_the_right_links(client, storage):
    await seed_catalog(storage)
    items = await listing(client)
    assert {i["brand"]["name"] for i in items.values()} == {
        "Nuvexa Medical",
        "Orvanta Health",
        "Velmora Care",
        "Medquora",
    }
    assert {i["category"]["name"] for i in items.values()} == {
        "Medical Consumables",
        "Medical Devices",
        "First Aid & Wound Care",
    }
    assert items["Nitrile Examination Gloves"]["brand"]["name"] == "Nuvexa Medical"
    assert items["Digital Thermometers"]["category"]["name"] == "Medical Devices"
    assert items["Adhesive Bandages"]["brand"]["name"] == "Medquora"
    assert items["Elastic Crepe Bandages"]["category"]["name"] == "First Aid & Wound Care"
    async with SessionLocal() as db:
        assert (await db.execute(select(func.count(Brand.id)))).scalar_one() == 4
        assert (await db.execute(select(func.count(Category.id)))).scalar_one() == 3


async def test_every_product_is_active_has_a_description_and_one_svg_placeholder(client, storage):
    await seed_catalog(storage)
    items = await listing(client)
    assert len(items) == 12
    for name, item in items.items():
        assert item["description"].strip(), name
        assert item["main_image"]["url"].endswith("/placeholder.svg"), name
        assert item["main_image"]["alt"] == name
    assert len(storage.files) == 12 and all(k.endswith(".svg") for k in storage.files)


async def test_a_placeholder_is_a_plain_svg_with_the_product_name(storage):
    await seed_catalog(storage)
    svgs = [b.decode() for b in storage.files.values()]
    assert all(s.startswith("<svg") and s.endswith("</svg>") for s in svgs)
    assert not any("<script" in s or "<image" in s for s in svgs)
    assert any("Gauze" in s for s in svgs)


def test_placeholder_svg_escapes_the_title_and_wraps_long_names():
    svg = placeholder_svg('Tom & "Jerry" <b>', "#ffffff")
    assert "&amp;" in svg and "&lt;b&gt;" in svg
    assert "<b>" not in svg and "& " not in svg.replace("&amp; ", "")
    long_title = placeholder_svg("Digital Blood Pressure Monitors", "#ffffff")
    assert long_title.count("<tspan") >= 2  # wrapped over several centred lines
    assert 'text-anchor="middle"' in long_title


async def test_every_demo_name_fits_the_placeholder(storage):
    for name, *_ in PRODUCTS:
        assert placeholder_svg(name, "#fff").count("<tspan") <= 3, name


async def test_seed_is_idempotent(storage):
    assert (await seed_catalog(storage)).startswith("created")
    files = dict(storage.files)
    assert (await seed_catalog(storage)).startswith("exists")
    assert storage.files == files
    async with SessionLocal() as db:
        assert (await db.execute(select(func.count(Product.id)))).scalar_one() == 12


async def test_reset_replaces_the_old_catalog_and_its_stored_images(client, storage):
    old_brand, old_category = await make_brand("Nova Health"), await make_category("Wound Care")
    await make_product(old_brand, old_category, "Old Gauze", images=2)
    storage.files["products/1/img0.webp"] = b"old"
    storage.files["products/1/img1.webp"] = b"old"

    result = await seed_catalog(storage, reset=True)
    assert result.startswith("created") and "2 stored images removed" in result
    items = await listing(client)
    assert set(items) == set(EXPECTED)  # the old product is gone
    assert not any(k.endswith(".webp") for k in storage.files)  # the old files are gone
    async with SessionLocal() as db:
        names = set((await db.execute(select(Brand.name))).scalars())
        assert "Nova Health" not in names and len(names) == 4
        assert (await db.execute(select(func.count(Category.id)))).scalar_one() == 3


async def test_reset_removes_everything_including_products_added_by_hand(client, storage):
    brand, category = await make_brand("Mine"), await make_category("Mine too")
    await make_product(brand, category, "Hand made")
    await seed_catalog(storage, reset=True)
    assert "Hand made" not in await listing(client)


async def test_reset_never_wipes_a_catalog_that_is_already_seeded(client, storage):
    """Leaving SEED_DEMO_RESET switched on must not destroy the manager's later edits."""
    await seed_catalog(storage)
    brand, category = await make_brand("Added later"), await make_category("Added later")
    await make_product(brand, category, "Real Product")
    result = await seed_catalog(storage, reset=True)
    assert result.startswith("exists") and "reset ignored" in result
    assert "Real Product" in await listing(client)


async def test_a_seeded_catalog_can_be_edited_and_its_placeholder_replaced(
    client, storage, admin_headers
):
    """The manager's path: open a product and remove the placeholder (the real pictures are
    uploaded through the normal image upload)."""
    await seed_catalog(storage)
    admin = (await client.get("/api/v1/admin/products", headers=admin_headers)).json()
    product = next(i for i in admin["items"] if i["name"] == "Sterile Gauze Pads")
    detail = (
        await client.get(f"/api/v1/admin/products/{product['id']}", headers=admin_headers)
    ).json()
    (image,) = detail["images"]
    assert (
        await client.delete(f"/api/v1/admin/images/{image['id']}", headers=admin_headers)
    ).status_code == 204
    assert image["url"].rsplit("/", 1)[-1] == "placeholder.svg"
    assert f"products/{product['id']}/placeholder.svg" not in storage.files  # file removed too
    after = (
        await client.get(f"/api/v1/admin/products/{product['id']}", headers=admin_headers)
    ).json()
    assert after["images"] == []


async def test_demo_customer_can_sign_in_and_is_not_an_admin(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "demo_password", "demo-password-123")
    assert (await seed_customer()).startswith("created")
    assert (await seed_customer()).startswith("exists")
    r = await client.post(
        "/api/v1/auth/login", json={"email": DEMO_EMAIL, "password": "demo-password-123"}
    )
    assert r.status_code == 200 and r.json()["user"]["role"] == "customer"


async def test_demo_customer_is_skipped_without_a_password(monkeypatch):
    monkeypatch.setattr(get_settings(), "demo_password", "")
    assert (await seed_customer()).startswith("skipped")
