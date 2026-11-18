import io

import pytest
from PIL import Image

from tests.factories import make_brand, make_category, make_product

URL = "/api/v1/admin"


def png(size=(200, 100), color=(200, 30, 30)) -> bytes:
    out = io.BytesIO()
    Image.new("RGB", size, color).save(out, format="PNG")
    return out.getvalue()


def jpeg(size=(200, 100)) -> bytes:
    out = io.BytesIO()
    Image.new("RGB", size, (10, 120, 200)).save(out, format="JPEG")
    return out.getvalue()


def webp(size=(50, 50)) -> bytes:
    out = io.BytesIO()
    Image.new("RGB", size, (10, 200, 10)).save(out, format="WEBP")
    return out.getvalue()


@pytest.fixture
async def product():
    return await make_product(await make_brand(), await make_category())


async def upload(client, headers, product, data, alt="Front view", name="a.png", **form):
    return await client.post(
        f"{URL}/products/{product}/images",
        files={"file": (name, data, "image/png")},
        data={"alt": alt, **form},
        headers=headers,
    )


@pytest.mark.parametrize("data", [png(), jpeg(), webp()], ids=["png", "jpeg", "webp"])
async def test_accepts_png_jpeg_and_webp_and_stores_webp(
    client, admin_headers, product, storage, data
):
    r = await upload(client, admin_headers, product, data, alt_ar="منظر أمامي")
    assert r.status_code == 201
    body = r.json()
    assert body["alt"] == "Front view" and body["alt_ar"] == "منظر أمامي" and body["position"] == 0
    (key,) = storage.files
    assert key.startswith(f"products/{product}/") and key.endswith(".webp")
    assert body["url"] == f"http://storage.test/{key}"
    assert Image.open(io.BytesIO(storage.files[key])).format == "WEBP"


async def test_large_images_are_scaled_down_and_metadata_is_stripped(
    client, admin_headers, product, storage
):
    img = Image.new("RGB", (3000, 1500), (5, 5, 5))
    exif = Image.Exif()
    exif[0x010F] = "SecretCameraMaker"
    out = io.BytesIO()
    img.save(out, format="JPEG", exif=exif)
    assert b"SecretCameraMaker" in out.getvalue()
    assert (await upload(client, admin_headers, product, out.getvalue())).status_code == 201
    (stored,) = storage.files.values()
    assert max(Image.open(io.BytesIO(stored)).size) == 1600
    assert b"SecretCameraMaker" not in stored


async def test_the_real_file_type_is_checked_not_the_name_or_content_type(
    client, admin_headers, product, storage
):
    for data in (b"just some text", b"GIF89a" + b"0" * 50, b"\x89PNG\r\n\x1a\n" + b"garbage" * 20):
        r = await upload(client, admin_headers, product, data, name="photo.png")
        assert r.status_code == 422 and r.json()["error"]["code"] == "image_invalid"
        assert "file" in r.json()["error"]["fields"]
    assert storage.files == {}


async def test_files_over_5mb_are_rejected(client, admin_headers, product, storage):
    r = await upload(client, admin_headers, product, png() + b"0" * (5 * 1024 * 1024))
    assert r.status_code == 413 and r.json()["error"]["code"] == "image_too_large"
    assert storage.files == {}


async def test_alt_text_is_required(client, admin_headers, product, storage):
    for alt in ("", "   "):
        assert (await upload(client, admin_headers, product, png(), alt=alt)).status_code == 422
    r = await client.post(
        f"{URL}/products/{product}/images",
        files={"file": ("a.png", png(), "image/png")},
        headers=admin_headers,
    )
    assert r.status_code == 422
    assert storage.files == {}


async def test_blank_arabic_alt_is_stored_as_null(client, admin_headers, product):
    r = await upload(client, admin_headers, product, png(), alt_ar="   ")
    assert r.json()["alt_ar"] is None


async def test_at_most_ten_images_per_product(client, admin_headers, product, storage):
    for _ in range(10):
        assert (await upload(client, admin_headers, product, png())).status_code == 201
    r = await upload(client, admin_headers, product, png())
    assert r.status_code == 409 and r.json()["error"]["code"] == "too_many_images"
    assert len(storage.files) == 10


async def test_uploads_get_increasing_positions_and_unknown_product_is_404(
    client, admin_headers, product
):
    a = (await upload(client, admin_headers, product, png())).json()
    b = (await upload(client, admin_headers, product, png())).json()
    assert (a["position"], b["position"]) == (0, 1)
    assert (await upload(client, admin_headers, 999, png())).status_code == 404


async def test_reorder_sets_the_main_image(client, admin_headers, product):
    ids = [
        (await upload(client, admin_headers, product, png(), alt=f"img {i}")).json()["id"]
        for i in range(3)
    ]
    new_order = [ids[2], ids[0], ids[1]]
    r = await client.put(
        f"{URL}/products/{product}/images/order",
        json={"image_ids": new_order},
        headers=admin_headers,
    )
    assert r.status_code == 200 and [i["id"] for i in r.json()] == new_order
    detail = (await client.get(f"{URL}/products/{product}", headers=admin_headers)).json()
    assert [i["id"] for i in detail["images"]] == new_order
    public = (await client.get(f"/api/v1/products/{product}")).json()
    assert public["main_image"]["id"] == ids[2]


@pytest.mark.parametrize(
    "make_ids",
    [lambda ids: ids[:1], lambda ids: ids + [999], lambda ids: ids + ids[:1], lambda ids: []],
)
async def test_reorder_must_list_every_image_exactly_once(client, admin_headers, product, make_ids):
    ids = [(await upload(client, admin_headers, product, png())).json()["id"] for _ in range(2)]
    r = await client.put(
        f"{URL}/products/{product}/images/order",
        json={"image_ids": make_ids(ids)},
        headers=admin_headers,
    )
    assert r.status_code == 422 and "image_ids" in r.json()["error"]["fields"]


async def test_update_alt_text(client, admin_headers, product):
    image = (await upload(client, admin_headers, product, png())).json()
    r = await client.put(
        f"{URL}/images/{image['id']}", json={"alt": "New", "alt_ar": "جديد"}, headers=admin_headers
    )
    assert r.status_code == 200 and (r.json()["alt"], r.json()["alt_ar"]) == ("New", "جديد")
    r = await client.put(f"{URL}/images/{image['id']}", json={"alt": ""}, headers=admin_headers)
    assert r.status_code == 422
    assert (
        await client.put(f"{URL}/images/999", json={"alt": "x"}, headers=admin_headers)
    ).status_code == 404


async def test_delete_image_removes_row_and_file_and_promotes_the_next_main(
    client, admin_headers, product, storage
):
    first = (await upload(client, admin_headers, product, png())).json()
    second = (await upload(client, admin_headers, product, png())).json()
    assert (
        await client.delete(f"{URL}/images/{first['id']}", headers=admin_headers)
    ).status_code == 204
    assert len(storage.files) == 1
    public = (await client.get(f"/api/v1/products/{product}")).json()
    assert public["main_image"]["id"] == second["id"]
    assert (
        await client.delete(f"{URL}/images/{first['id']}", headers=admin_headers)
    ).status_code == 404


async def test_a_failed_database_write_does_not_leave_the_file_behind(
    client, admin_headers, product, storage, monkeypatch
):
    from sqlalchemy.ext.asyncio import AsyncSession

    async def boom(self):
        raise RuntimeError("db down")

    monkeypatch.setattr(AsyncSession, "commit", boom)
    from httpx import ASGITransport, AsyncClient

    from app.main import app

    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test"
    ) as c:
        r = await upload(c, admin_headers, product, png())
    assert r.status_code == 500
    assert storage.files == {}


async def test_guards(client, customer_headers, product):
    files = {"file": ("a.png", png(), "image/png")}
    assert (
        await client.post(f"{URL}/products/{product}/images", files=files, data={"alt": "x"})
    ).status_code == 401
    r = await client.post(
        f"{URL}/products/{product}/images", files=files, data={"alt": "x"}, headers=customer_headers
    )
    assert r.status_code == 403
