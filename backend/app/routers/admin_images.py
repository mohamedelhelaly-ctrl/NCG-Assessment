from fastapi import APIRouter, Depends, File, Form, Response, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.database import get_db
from app.schemas.admin import ImageAdmin, ImageOrder, ImageUpdate
from app.schemas.common import _blank_to_none
from app.services import catalog_view, product_admin
from app.services.images import MAX_BYTES
from app.services.storage import StorageBackend, get_storage

router = APIRouter(prefix="/admin", tags=["admin images"])


@router.post("/products/{product_id}/images", response_model=ImageAdmin, status_code=201)
async def upload_image(
    product_id: int,
    file: UploadFile = File(...),
    alt: str = Form(...),
    alt_ar: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
):
    alt, alt_ar = alt.strip(), _blank_to_none(alt_ar)
    # Validated by hand: length rules on multipart form fields are not enforced by the framework.
    fields = {}
    if not alt or len(alt) > 200:
        fields["alt"] = "Alt text is required (1 to 200 characters)"
    if alt_ar and len(alt_ar) > 200:
        fields["alt_ar"] = "Must be at most 200 characters"
    if fields:
        raise AppError(422, "validation_error", "Some fields are invalid", fields)
    data = await file.read(MAX_BYTES + 1)  # never read more than the limit plus one byte
    image = await product_admin.add_image(db, storage, product_id, data, alt, alt_ar)
    return catalog_view.admin_image(image, storage)


@router.put("/products/{product_id}/images/order", response_model=list[ImageAdmin])
async def reorder_images(
    product_id: int,
    body: ImageOrder,
    db: AsyncSession = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
):
    images = await product_admin.reorder_images(db, product_id, body.image_ids)
    return [catalog_view.admin_image(i, storage) for i in images]


@router.put("/images/{image_id}", response_model=ImageAdmin)
async def update_image(
    image_id: int,
    body: ImageUpdate,
    db: AsyncSession = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
):
    return catalog_view.admin_image(await product_admin.update_image(db, image_id, body), storage)


@router.delete("/images/{image_id}", status_code=204)
async def delete_image(
    image_id: int,
    db: AsyncSession = Depends(get_db),
    storage: StorageBackend = Depends(get_storage),
):
    await product_admin.delete_image(db, storage, image_id)
    return Response(status_code=204)
