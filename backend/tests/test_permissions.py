import pytest
from fastapi import Depends, FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import update

from app.core.errors import register_error_handlers
from app.core.permissions import PERMISSIONS, require_module
from app.core.security import create_access_token
from app.database import SessionLocal
from app.models.user import User
from tests.conftest import auth_header, make_user

# A throwaway app that uses the real guards, so role enforcement is tested end to end.
guarded = FastAPI()
register_error_handlers(guarded)


@guarded.get("/admin-only")
async def admin_only(user: User = Depends(require_module("catalog_admin", "write"))):
    return {"id": user.id}


@guarded.get("/any-signed-in")
async def any_signed_in(user: User = Depends(require_module("cart", "read"))):
    return {"id": user.id}


@pytest.fixture
async def gclient():
    async with AsyncClient(transport=ASGITransport(app=guarded), base_url="http://test") as c:
        yield c


async def test_guest_gets_401(gclient):
    assert (await gclient.get("/admin-only")).status_code == 401
    assert (await gclient.get("/any-signed-in")).status_code == 401


async def test_customer_gets_403_on_admin_routes_but_can_use_the_cart(gclient):
    user = await make_user("c@shop.example", role="customer")
    h = auth_header(create_access_token(user.id))
    r = await gclient.get("/admin-only", headers=h)
    assert r.status_code == 403 and r.json()["error"]["code"] == "forbidden"
    assert (await gclient.get("/any-signed-in", headers=h)).status_code == 200


async def test_admin_can_use_admin_routes(gclient):
    admin = await make_user("a@shop.example", role="admin")
    h = auth_header(create_access_token(admin.id))
    assert (await gclient.get("/admin-only", headers=h)).status_code == 200


async def test_role_is_read_from_the_database_not_the_token(gclient):
    admin = await make_user("a@shop.example", role="admin")
    h = auth_header(create_access_token(admin.id))
    assert (await gclient.get("/admin-only", headers=h)).status_code == 200
    async with SessionLocal() as db:
        await db.execute(update(User).where(User.id == admin.id).values(role="customer"))
        await db.commit()
    assert (await gclient.get("/admin-only", headers=h)).status_code == 403  # same token


def test_unknown_module_fails_at_import_time():
    with pytest.raises(KeyError):
        require_module("catalog_adminn", "write")


def test_every_permission_names_real_roles():
    roles = {"customer", "admin"}
    for module, actions in PERMISSIONS.items():
        for action, allowed in actions.items():
            assert set(allowed) <= roles, (module, action)
