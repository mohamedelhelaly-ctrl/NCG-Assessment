from functools import lru_cache

from app.config import get_settings
from app.services.storage.base import StorageBackend
from app.services.storage.local import LocalStorage
from app.services.storage.r2 import R2Storage


@lru_cache
def get_storage() -> StorageBackend:
    """FastAPI dependency (tests override it with an in-memory backend)."""
    s = get_settings()
    if s.storage_backend == "r2":
        return R2Storage(
            s.r2_account_id,
            s.r2_access_key_id,
            s.r2_secret_access_key,
            s.r2_bucket,
            s.r2_public_url,
        )
    return LocalStorage(s.uploads_dir, s.public_api_url)


__all__ = ["StorageBackend", "LocalStorage", "R2Storage", "get_storage"]
