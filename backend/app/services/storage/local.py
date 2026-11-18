import asyncio
from pathlib import Path

from app.services.storage.base import StorageBackend


class LocalStorage(StorageBackend):
    def __init__(self, root: str, public_base_url: str):
        self.root = Path(root).resolve()
        self.public_base_url = public_base_url.rstrip("/")

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if not path.is_relative_to(self.root):  # never write outside the uploads folder
            raise ValueError("invalid storage key")
        return path

    async def save(self, key: str, data: bytes, content_type: str) -> None:
        path = self._path(key)

        def write() -> None:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)

        await asyncio.to_thread(write)

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(self._path(key).unlink, True)

    def url(self, key: str) -> str:
        return f"{self.public_base_url}/media/{key}"
