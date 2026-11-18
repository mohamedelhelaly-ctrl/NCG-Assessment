from sqlalchemy import Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base, TimestampMixin


class Category(TimestampMixin, Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    name_ar: Mapped[str | None] = mapped_column(String(100))


# Names are unique ignoring case.
Index("uq_categories_name_lower", func.lower(Category.name), unique=True)
