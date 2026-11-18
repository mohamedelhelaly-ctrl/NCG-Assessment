from sqlalchemy import ColumnElement, and_, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import contains_eager, selectinload

from app.core.i18n import Lang
from app.models.brand import Brand
from app.models.category import Category
from app.models.pricing_tier import PricingTier
from app.models.product import Product


def has_tiers() -> ColumnElement[bool]:
    return exists(select(1).where(PricingTier.product_id == Product.id))


def visible() -> ColumnElement[bool]:
    """A product is publicly visible when it is active AND has at least one tier. This one
    expression is used by the listing, the detail, the counts and the quote."""
    return and_(Product.is_active.is_(True), has_tiers())


def resolved(lang: Lang, english, arabic) -> ColumnElement[str]:
    """SQL twin of core.i18n.pick, used for sorting by the displayed name."""
    if lang == "ar":
        return func.coalesce(func.nullif(func.btrim(arabic), ""), english)
    return english


def escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def search_clause(term: str) -> ColumnElement[bool]:
    """Product, brand or category name, in either language (substring, case-insensitive)."""
    pattern = f"%{escape_like(term)}%"
    columns = (
        Product.name,
        Product.name_ar,
        Brand.name,
        Brand.name_ar,
        Category.name,
        Category.name_ar,
    )
    return or_(*(c.ilike(pattern, escape="\\") for c in columns))


_WITH_RELATIONS = (
    contains_eager(Product.brand),
    contains_eager(Product.category),
    selectinload(Product.tiers),
    selectinload(Product.images),
)


class ProductCRUD:
    def _base(self):
        return select(Product).join(Product.brand).join(Product.category)

    async def get(self, db: AsyncSession, product_id: int) -> Product | None:
        stmt = self._base().options(*_WITH_RELATIONS).where(Product.id == product_id)
        return (await db.execute(stmt)).unique().scalar_one_or_none()

    async def get_visible(self, db: AsyncSession, product_id: int) -> Product | None:
        stmt = self._base().options(*_WITH_RELATIONS).where(Product.id == product_id, visible())
        return (await db.execute(stmt)).unique().scalar_one_or_none()

    async def list(
        self,
        db: AsyncSession,
        *,
        page: int,
        page_size: int,
        public: bool,
        search: str | None = None,
        brand_id: int | None = None,
        category_id: int | None = None,
        status: str = "all",
        missing_ar: bool = False,
    ) -> tuple[list[Product], int]:
        conditions: list[ColumnElement[bool]] = []
        if public:
            conditions.append(visible())
        if search:
            conditions.append(search_clause(search))
        if brand_id is not None:
            conditions.append(Product.brand_id == brand_id)
        if category_id is not None:
            conditions.append(Product.category_id == category_id)
        if status == "active":
            conditions.append(Product.is_active.is_(True))
        elif status == "inactive":
            conditions.append(Product.is_active.is_(False))
        elif status == "no_tiers":
            conditions.append(~has_tiers())
        if missing_ar:
            conditions.append(Product.name_ar.is_(None))

        total = (
            await db.execute(
                select(func.count(Product.id))
                .select_from(Product)
                .join(Product.brand)
                .join(Product.category)
                .where(*conditions)
            )
        ).scalar_one()
        stmt = (
            self._base()
            .options(*_WITH_RELATIONS)
            .where(*conditions)
            .order_by(Product.created_at.desc(), Product.id.desc())  # stable order
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        products = list((await db.execute(stmt)).unique().scalars().all())
        return products, total

    async def public_counts(self, db: AsyncSession, column, model, lang: Lang):
        """Brands or categories that have at least one visible product, with their counts."""
        name = resolved(lang, model.name, model.name_ar)
        stmt = (
            select(model, func.count(Product.id))
            .join(Product, column == model.id)
            .where(visible())
            .group_by(model.id)
            .order_by(func.lower(name), model.id)
        )
        return [(row[0], row[1]) for row in (await db.execute(stmt)).all()]


product_crud = ProductCRUD()
