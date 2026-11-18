async def test_healthz_reports_database_ok(client):
    response = await client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


async def test_unknown_route_returns_404(client):
    response = await client.get("/nope")
    assert response.status_code == 404


async def test_every_response_carries_basic_security_headers(client):
    for path in ("/healthz", "/api/v1/products", "/nope"):  # success, a list, and a 404
        response = await client.get(path)
        assert response.headers["x-content-type-options"] == "nosniff", path
        assert response.headers["referrer-policy"] == "no-referrer", path


async def test_error_responses_carry_them_too(client):
    response = await client.post("/api/v1/auth/login", json={"email": "x", "password": "y"})
    assert response.status_code == 401
    assert response.headers["x-content-type-options"] == "nosniff"
