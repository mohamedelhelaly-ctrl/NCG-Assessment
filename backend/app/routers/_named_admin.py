"""Brands and categories are managed identically, so one factory builds both admin routers."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, conflict, not_found
from app.core.i18n import Lang, get_lang, pick
from app.crud.named import NamedCRUD
from app.database import get_db
from app.schemas.admin import NamedAdmin, NamedIn


def _view(item, count: int, lang: Lang) -> dict:
    return {
        "id": item.id,
        "name": item.name,
        "name_ar": item.name_ar,
        "display_name": pick(lang, item.name, item.name_ar),
        "product_count": count,
    }


def build_named_admin_router(kind: str, crud: NamedCRUD, prefix: str) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=[f"admin {kind}"])

    def duplicate() -> AppError:
        message = f"A {kind} with this name already exists"
        return AppError(409, "duplicate_name", message, fields={"name": message})

    def in_use(count: int) -> AppError:
        noun = "product uses" if count == 1 else "products use"
        return conflict(f"{kind}_in_use", f"{count} {noun} this {kind}", {"count": count})

    @router.get("", response_model=list[NamedAdmin])
    async def list_items(db: AsyncSession = Depends(get_db), lang: Lang = Depends(get_lang)):
        return [_view(item, count, lang) for item, count in await crud.list_with_counts(db)]

    @router.post("", response_model=NamedAdmin, status_code=201)
    async def create(
        body: NamedIn, db: AsyncSession = Depends(get_db), lang: Lang = Depends(get_lang)
    ):
        if await crud.name_taken(db, body.name):
            raise duplicate()
        item = crud.model(name=body.name, name_ar=body.name_ar)
        db.add(item)
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            raise duplicate() from None
        return _view(item, 0, lang)

    @router.put("/{item_id}", response_model=NamedAdmin)
    async def update(
        item_id: int,
        body: NamedIn,
        db: AsyncSession = Depends(get_db),
        lang: Lang = Depends(get_lang),
    ):
        item = await crud.get(db, item_id)
        if item is None:
            raise not_found(f"{kind.capitalize()} not found")
        if await crud.name_taken(db, body.name, exclude_id=item_id):
            raise duplicate()
        item.name, item.name_ar = body.name, body.name_ar
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            raise duplicate() from None
        return _view(item, await crud.count_products(db, item_id), lang)

    @router.delete("/{item_id}", status_code=204)
    async def delete(item_id: int, db: AsyncSession = Depends(get_db)):
        item = await crud.get(db, item_id)
        if item is None:
            raise not_found(f"{kind.capitalize()} not found")
        count = await crud.count_products(db, item_id)
        if count:  # includes inactive products; the database also enforces this with RESTRICT
            raise in_use(count)
        await db.delete(item)
        try:
            await db.commit()
        except IntegrityError:  # a product was attached at the same moment
            await db.rollback()
            raise in_use(await crud.count_products(db, item_id)) from None
        return Response(status_code=204)

    return router
