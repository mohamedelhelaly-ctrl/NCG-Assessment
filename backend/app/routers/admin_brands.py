from app.crud.named import brand_crud
from app.routers._named_admin import build_named_admin_router

router = build_named_admin_router("brand", brand_crud, "/admin/brands")
