from app.crud.named import category_crud
from app.routers._named_admin import build_named_admin_router

router = build_named_admin_router("category", category_crud, "/admin/categories")
