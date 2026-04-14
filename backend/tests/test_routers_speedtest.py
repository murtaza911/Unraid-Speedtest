import json
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock

from app.main import create_app


@pytest.mark.asyncio
async def test_health(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_run_speedtest_sse(client):
    async def mock_run_test(server_id=None):
        yield {"type": "status", "data": {"phase": "connecting"}}
        yield {"type": "result", "data": {
            "timestamp": "2026-04-14T10:00:00Z",
            "download_mbps": 542.5, "upload_mbps": 128.3,
            "ping_ms": 12.1, "jitter_ms": 3.2,
            "server_id": 12345, "server_name": "Test",
            "server_location": "SF", "isp": "Comcast",
            "result_url": "https://example.com",
        }}

    with patch.object(client.app.state.runner, "run_test", side_effect=mock_run_test):
        resp = await client.get("/api/speedtest/run")
        assert resp.status_code == 200


@pytest.mark.asyncio
async def test_list_results(client):
    resp = await client.get("/api/results")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_delete_nonexistent_result(client):
    resp = await client.delete("/api/results/999")
    assert resp.status_code == 404
