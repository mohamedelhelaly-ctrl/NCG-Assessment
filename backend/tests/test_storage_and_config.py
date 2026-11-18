import pytest

from app.config import Settings, validate_settings
from app.services.storage import LocalStorage, R2Storage


async def test_local_storage_saves_serves_a_url_and_deletes(tmp_path):
    store = LocalStorage(str(tmp_path), "http://api.test/")
    await store.save("products/1/a.webp", b"data", "image/webp")
    assert (tmp_path / "products/1/a.webp").read_bytes() == b"data"
    assert store.url("products/1/a.webp") == "http://api.test/media/products/1/a.webp"
    await store.delete("products/1/a.webp")
    assert not (tmp_path / "products/1/a.webp").exists()
    await store.delete("products/1/a.webp")  # deleting a missing file is not an error


async def test_local_storage_refuses_keys_that_escape_the_folder(tmp_path):
    store = LocalStorage(str(tmp_path), "http://api.test")
    with pytest.raises(ValueError):
        await store.save("../evil.txt", b"x", "text/plain")


def test_r2_urls_are_built_from_the_public_base():
    store = R2Storage("acct", "key", "secret", "bucket", "https://img.example.com/")
    assert store.url("products/1/a.webp") == "https://img.example.com/products/1/a.webp"


STRONG = "x" * 40
R2 = dict(
    r2_account_id="a",
    r2_access_key_id="k",
    r2_secret_access_key="s",
    r2_bucket="b",
    r2_public_url="https://i.test",
)


def settings(**over) -> Settings:
    return Settings(_env_file=None, **over)


def test_development_defaults_are_valid():
    validate_settings(settings())


def test_production_needs_r2_and_a_strong_secret():
    with pytest.raises(RuntimeError, match="STORAGE_BACKEND=r2"):
        validate_settings(settings(env="production", jwt_secret=STRONG))
    with pytest.raises(RuntimeError, match="needs R2_"):
        validate_settings(settings(env="production", jwt_secret=STRONG, storage_backend="r2"))
    with pytest.raises(RuntimeError, match="JWT_SECRET"):
        validate_settings(
            settings(env="production", jwt_secret="short", storage_backend="r2", **R2)
        )
    validate_settings(settings(env="production", jwt_secret=STRONG, storage_backend="r2", **R2))


def test_unknown_storage_backend_is_rejected():
    with pytest.raises(RuntimeError, match="local' or 'r2"):
        validate_settings(settings(storage_backend="s3"))
