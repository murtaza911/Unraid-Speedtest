import pytest
from datetime import datetime, timezone

from app.database import Database


@pytest.mark.asyncio
async def test_init_creates_tables(db):
    tables = await db.fetch_all("SELECT name FROM sqlite_master WHERE type='table'")
    table_names = [row["name"] for row in tables]
    assert "test_results" in table_names
    assert "favorite_servers" in table_names
    assert "scheduler_config" in table_names


@pytest.mark.asyncio
async def test_insert_and_get_result(db):
    result_id = await db.insert_result(
        timestamp=datetime.now(timezone.utc).isoformat(),
        download_mbps=542.5,
        upload_mbps=128.3,
        ping_ms=12.1,
        jitter_ms=3.2,
        server_id=12345,
        server_name="Test Server",
        server_location="San Francisco, CA",
        isp="Comcast",
        result_url="https://www.speedtest.net/result/123",
        triggered_by="manual",
    )
    assert result_id is not None

    result = await db.get_result(result_id)
    assert result["download_mbps"] == 542.5
    assert result["server_name"] == "Test Server"
    assert result["triggered_by"] == "manual"


@pytest.mark.asyncio
async def test_list_results_newest_first(db):
    await db.insert_result(
        timestamp="2026-04-14T10:00:00+00:00",
        download_mbps=100.0, upload_mbps=50.0, ping_ms=10.0, jitter_ms=2.0,
        server_id=1, server_name="A", server_location="A", isp="A",
        result_url="", triggered_by="manual",
    )
    await db.insert_result(
        timestamp="2026-04-14T12:00:00+00:00",
        download_mbps=200.0, upload_mbps=60.0, ping_ms=8.0, jitter_ms=1.5,
        server_id=1, server_name="A", server_location="A", isp="A",
        result_url="", triggered_by="scheduled",
    )
    results = await db.list_results()
    assert len(results) == 2
    assert results[0]["download_mbps"] == 200.0  # newest first


@pytest.mark.asyncio
async def test_delete_result(db):
    result_id = await db.insert_result(
        timestamp=datetime.now(timezone.utc).isoformat(),
        download_mbps=100.0, upload_mbps=50.0, ping_ms=10.0, jitter_ms=2.0,
        server_id=1, server_name="A", server_location="A", isp="A",
        result_url="", triggered_by="manual",
    )
    deleted = await db.delete_result(result_id)
    assert deleted is True
    result = await db.get_result(result_id)
    assert result is None


@pytest.mark.asyncio
async def test_favorites_crud(db):
    await db.add_favorite(server_id=100, name="Test Server", location="NYC")
    favorites = await db.list_favorites()
    assert len(favorites) == 1
    assert favorites[0]["server_id"] == 100

    deleted = await db.remove_favorite(100)
    assert deleted is True
    favorites = await db.list_favorites()
    assert len(favorites) == 0


@pytest.mark.asyncio
async def test_scheduler_config_defaults(db):
    config = await db.get_scheduler_config()
    assert config["enabled"] is False
    assert config["interval_minutes"] == 360
    assert config["server_id"] is None


@pytest.mark.asyncio
async def test_update_scheduler_config(db):
    await db.update_scheduler_config(enabled=True, interval_minutes=60, server_id=42)
    config = await db.get_scheduler_config()
    assert config["enabled"] is True
    assert config["interval_minutes"] == 60
    assert config["server_id"] == 42
