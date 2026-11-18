from datetime import timedelta

from sqlalchemy import select, update

from app.core.rate_limit import limiter
from app.core.security import create_access_token
from app.database import SessionLocal
from app.models.user import User
from tests.conftest import auth_header, make_user

REGISTER = {"full_name": "Sara Ali", "email": "Sara@Shop.example", "password": "a-long-password"}


async def test_register_creates_customer_and_returns_token(client):
    r = await client.post("/api/v1/auth/register", json=REGISTER)
    assert r.status_code == 201
    body = r.json()
    assert body["token_type"] == "bearer" and body["access_token"]
    assert body["user"]["role"] == "customer"
    assert body["user"]["email"] == "sara@shop.example"  # lowercased
    assert "password" not in str(body).lower().replace("password_hash", "")
    assert r.headers["cache-control"] == "no-store"


async def test_register_cannot_choose_a_role(client):
    r = await client.post("/api/v1/auth/register", json={**REGISTER, "role": "admin"})
    assert r.status_code == 201
    assert r.json()["user"]["role"] == "customer"


async def test_register_duplicate_email_is_409_case_insensitive(client):
    await client.post("/api/v1/auth/register", json=REGISTER)
    r = await client.post("/api/v1/auth/register", json={**REGISTER, "email": "sara@shop.example"})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "email_taken"


async def test_register_validation_errors_use_the_error_shape(client):
    r = await client.post(
        "/api/v1/auth/register", json={"full_name": " ", "email": "nope", "password": "short"}
    )
    assert r.status_code == 422
    error = r.json()["error"]
    assert error["code"] == "validation_error"
    assert {"full_name", "email", "password"} <= set(error["fields"])
    assert "10 characters" in error["fields"]["password"]


async def test_register_rejects_password_over_72_bytes(client):
    r = await client.post("/api/v1/auth/register", json={**REGISTER, "password": "x" * 73})
    assert r.status_code == 422
    assert "72" in r.json()["error"]["fields"]["password"]


async def test_login_success(client):
    await make_user("a@shop.example", "correct-horse-1")
    r = await client.post(
        "/api/v1/auth/login", json={"email": "A@shop.example", "password": "correct-horse-1"}
    )
    assert r.status_code == 200
    assert r.json()["user"]["email"] == "a@shop.example"


async def test_login_failures_are_one_generic_error(client):
    await make_user("a@shop.example", "correct-horse-1")
    await make_user("off@shop.example", "correct-horse-1", is_active=False)
    attempts = [
        {"email": "a@shop.example", "password": "wrong-password"},
        {"email": "nobody@shop.example", "password": "correct-horse-1"},
        {"email": "off@shop.example", "password": "correct-horse-1"},  # disabled account
    ]
    responses = [await client.post("/api/v1/auth/login", json=a) for a in attempts]
    assert all(r.status_code == 401 for r in responses)
    assert len({r.text for r in responses}) == 1  # identical bodies
    assert responses[0].json()["error"]["code"] == "invalid_credentials"


async def test_me_requires_a_valid_token(client):
    assert (await client.get("/api/v1/auth/me")).status_code == 401
    r = await client.get("/api/v1/auth/me", headers=auth_header("garbage"))
    assert r.status_code == 401 and r.json()["error"]["code"] == "invalid_token"


async def test_me_returns_the_current_user(client):
    user = await make_user("a@shop.example")
    r = await client.get("/api/v1/auth/me", headers=auth_header(create_access_token(user.id)))
    assert r.status_code == 200
    assert r.json() == {
        "id": user.id,
        "email": "a@shop.example",
        "full_name": "Test User",
        "role": "customer",
    }
    assert r.headers["cache-control"] == "no-store"


async def test_expired_token_is_rejected(client):
    user = await make_user()
    token = create_access_token(user.id, expires_in=timedelta(seconds=-5))
    r = await client.get("/api/v1/auth/me", headers=auth_header(token))
    assert r.status_code == 401


async def test_disabled_user_is_rejected_on_every_request(client):
    user = await make_user()
    token = create_access_token(user.id)
    assert (await client.get("/api/v1/auth/me", headers=auth_header(token))).status_code == 200
    async with SessionLocal() as db:
        await db.execute(update(User).where(User.id == user.id).values(is_active=False))
        await db.commit()
    assert (await client.get("/api/v1/auth/me", headers=auth_header(token))).status_code == 401


async def test_token_for_a_deleted_user_is_rejected(client):
    user = await make_user()
    token = create_access_token(user.id)
    async with SessionLocal() as db:
        await db.delete(await db.get(User, user.id))
        await db.commit()
    assert (await client.get("/api/v1/auth/me", headers=auth_header(token))).status_code == 401


async def test_login_is_rate_limited(client):
    limiter.enabled = True
    try:
        statuses = [
            (
                await client.post(
                    "/api/v1/auth/login",
                    json={"email": "x@shop.example", "password": "whatever-123"},
                )
            ).status_code
            for _ in range(12)
        ]
    finally:
        limiter.enabled = False
    assert statuses[:10] == [401] * 10
    assert statuses[10:] == [429, 429]


async def test_rate_limit_error_uses_the_error_shape(client):
    limiter.enabled = True
    try:
        for _ in range(11):
            r = await client.post(
                "/api/v1/auth/login", json={"email": "x@shop.example", "password": "whatever-123"}
            )
    finally:
        limiter.enabled = False
    assert r.status_code == 429 and r.json()["error"]["code"] == "rate_limited"


async def test_register_is_rate_limited(client):
    limiter.enabled = True
    try:
        statuses = [
            (
                await client.post(
                    "/api/v1/auth/register",
                    json={**REGISTER, "email": f"u{i}@shop.example"},
                )
            ).status_code
            for i in range(6)
        ]
    finally:
        limiter.enabled = False
    assert statuses == [201] * 5 + [429]


async def test_passwords_are_stored_hashed(client):
    await client.post("/api/v1/auth/register", json=REGISTER)
    async with SessionLocal() as db:
        stored = (await db.execute(select(User.password_hash))).scalar_one()
    assert stored.startswith("$2") and "a-long-password" not in stored
