from sqlalchemy import func, select

from app.config import get_settings
from app.database import SessionLocal
from app.models.brand import Brand
from app.models.category import Category
from app.models.product import Product
from scripts.seed_demo import DEMO_EMAIL, seed_catalog, seed_customer

AR = {"Accept-Language": "ar"}


async def test_seed_creates_the_brief_s_one_two_and_three_option_products(client, storage):
    assert (await seed_catalog(storage)).startswith("created")
    items = {
        i["name"]: i
        for i in (await client.get("/api/v1/products", params={"page_size": 48})).json()["items"]
    }
    counts = {name: len(i["tiers"]) for name, i in items.items()}
    assert counts["Sterile Gauze Pads"] == 1  # Product A
    assert counts["Adhesive Bandage Strips"] == 2  # Product B
    assert counts["Vitamin C 500 mg"] == 3  # Product C
    assert [(t["units"], t["price_fils"]) for t in items["Vitamin C 500 mg"]["tiers"]] == [
        (1, 5500),
        (4, 19500),
        (12, 55000),
    ]
    assert [(t["units"], t["price_fils"]) for t in items["Adhesive Bandage Strips"]["tiers"]] == [
        (1, 2750),
        (4, 9900),
    ]


async def test_seed_has_two_or_more_brands_and_categories_with_images(client, storage):
    await seed_catalog(storage)
    async with SessionLocal() as db:
        assert (await db.execute(select(func.count(Brand.id)))).scalar_one() >= 2
        assert (await db.execute(select(func.count(Category.id)))).scalar_one() >= 2
    items = (await client.get("/api/v1/products", params={"page_size": 48})).json()["items"]
    assert all(i["main_image"] for i in items)
    assert len(storage.files) >= 10 and all(k.endswith(".webp") for k in storage.files)


async def test_seed_includes_fallback_and_admin_only_examples(client, storage, admin_headers):
    await seed_catalog(storage)
    ar = {i["name"] for i in (await client.get("/api/v1/products", headers=AR)).json()["items"]}
    assert "Digital Thermometer" in ar and "فيتامين سي 500 ملغ" in ar  # no Arabic -> English shown
    public = {i["name"] for i in (await client.get("/api/v1/products")).json()["items"]}
    assert not any("draft" in n.lower() for n in public)  # admin-only draft is hidden
    admin = (await client.get("/api/v1/admin/products", headers=admin_headers)).json()
    draft = next(i for i in admin["items"] if "draft" in i["name"].lower())
    assert draft["tier_count"] == 0 and draft["is_active"] is False


async def test_seed_is_idempotent(storage):
    assert (await seed_catalog(storage)).startswith("created")
    files = dict(storage.files)
    assert (await seed_catalog(storage)).startswith("exists")
    assert storage.files == files
    async with SessionLocal() as db:
        assert (await db.execute(select(func.count(Product.id)))).scalar_one() == 5


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
