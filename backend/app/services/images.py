"""Validate and normalise an uploaded image: check size and real file type, strip metadata,
cap the dimensions and re-encode as WebP."""

import asyncio
import io
import uuid

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.errors import AppError

MAX_BYTES = 5 * 1024 * 1024
MAX_PIXELS = 40_000_000
MAX_SIDE = 1600
MAX_IMAGES_PER_PRODUCT = 10
CONTENT_TYPE = "image/webp"


def _looks_like_image(data: bytes) -> bool:
    """Magic bytes for JPEG, PNG and WebP. Filename and client content type are ignored."""
    return (
        data.startswith(b"\xff\xd8\xff")
        or data.startswith(b"\x89PNG\r\n\x1a\n")
        or (data[:4] == b"RIFF" and data[8:12] == b"WEBP")
    )


def _invalid(message: str = "The file is not a valid JPEG, PNG or WebP image") -> AppError:
    return AppError(422, "image_invalid", message, fields={"file": message})


def _process(data: bytes) -> bytes:
    if not _looks_like_image(data):
        raise _invalid()
    try:
        with Image.open(io.BytesIO(data)) as probe:
            probe.verify()
        with Image.open(io.BytesIO(data)) as image:
            if image.width * image.height > MAX_PIXELS:
                raise _invalid("The image has too many pixels")
            image = ImageOps.exif_transpose(image)  # apply the rotation, then drop all metadata
            has_alpha = image.mode in ("RGBA", "LA") or "transparency" in image.info
            image = image.convert("RGBA" if has_alpha else "RGB")
            image.thumbnail((MAX_SIDE, MAX_SIDE))
            out = io.BytesIO()
            image.save(out, format="WEBP", quality=85)
            return out.getvalue()
    except (UnidentifiedImageError, OSError, SyntaxError, Image.DecompressionBombError):
        raise _invalid() from None


async def process_upload(data: bytes) -> bytes:
    if len(data) > MAX_BYTES:
        raise AppError(
            413,
            "image_too_large",
            "The image must be 5 MB or smaller",
            fields={"file": "The image must be 5 MB or smaller"},
        )
    return await asyncio.to_thread(_process, data)


def new_storage_key(product_id: int) -> str:
    return f"products/{product_id}/{uuid.uuid4().hex}.webp"
