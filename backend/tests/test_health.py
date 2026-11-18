async def test_healthz_reports_database_ok(client):
    response = await client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


async def test_unknown_route_returns_404(client):
    response = await client.get("/nope")
    assert response.status_code == 404
