from abc import ABC, abstractmethod


class StorageBackend(ABC):
    """Where uploaded images live. Only the storage key is stored in the database."""

    @abstractmethod
    async def save(self, key: str, data: bytes, content_type: str) -> None: ...

    @abstractmethod
    async def delete(self, key: str) -> None: ...

    @abstractmethod
    def url(self, key: str) -> str: ...
