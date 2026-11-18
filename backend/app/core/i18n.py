"""Language handling. Admin content has an English value (required) and an optional Arabic one;
the displayed value is the Arabic if present, else the English, decided per field."""

from typing import Literal

from fastapi import Request, Response

Lang = Literal["en", "ar"]


def parse_lang(header: str | None) -> Lang:
    """Read only the primary tag of the first language: 'ar', 'ar-KW;q=0.9' -> ar; else en."""
    if not header:
        return "en"
    first = header.split(",")[0].split(";")[0].strip().lower()
    return "ar" if first == "ar" or first.startswith("ar-") else "en"


def pick(lang: Lang, en: str, ar: str | None) -> str:
    if lang == "ar" and ar and ar.strip():
        return ar.strip()
    return en


async def get_lang(request: Request, response: Response) -> Lang:
    """Dependency: the request language. Marks the response as varying by language."""
    response.headers["Vary"] = "Accept-Language"
    return parse_lang(request.headers.get("accept-language"))
