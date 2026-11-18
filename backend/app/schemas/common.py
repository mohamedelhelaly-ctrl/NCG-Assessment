from typing import Annotated

from pydantic import AfterValidator, BaseModel, BeforeValidator, StringConstraints


def _blank_to_none(value):
    """Whitespace-only text means 'no Arabic translation' and is stored as null."""
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def text(max_length: int):
    return Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=max_length)
    ]


def optional_text(max_length: int):
    def check_length(value: str | None) -> str | None:
        if value is not None and len(value) > max_length:
            raise ValueError(f"Must be at most {max_length} characters")
        return value

    return Annotated[str | None, BeforeValidator(_blank_to_none), AfterValidator(check_length)]


class Page[T](BaseModel):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int


def make_page(items: list, total: int, page: int, page_size: int) -> dict:
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, -(-total // page_size)),
    }
