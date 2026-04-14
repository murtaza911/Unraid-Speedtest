import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.main import create_app


@pytest.mark.asyncio
async def test_get_scheduler_defaults(client):
    resp = await client.get("/api/scheduler")
    assert resp.status_code == 200
    data = resp.json()
    assert data["enabled"] is False
    assert data["interval_minutes"] == 360


@pytest.mark.asyncio
async def test_update_scheduler(client):
    resp = await client.put("/api/scheduler", json={
        "enabled": True,
        "interval_minutes": 120,
        "server_id": 42,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["enabled"] is True
    assert data["interval_minutes"] == 120
    assert data["server_id"] == 42
