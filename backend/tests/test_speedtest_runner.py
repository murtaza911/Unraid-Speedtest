from __future__ import annotations

import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from app.speedtest_runner import SpeedtestRunner


SAMPLE_CLI_OUTPUT = json.dumps({
    "type": "result",
    "timestamp": "2026-04-14T10:00:00Z",
    "ping": {"jitter": 3.2, "latency": 12.1},
    "download": {"bandwidth": 67812500, "bytes": 542500000, "elapsed": 8000},
    "upload": {"bandwidth": 16037500, "bytes": 128300000, "elapsed": 8000},
    "isp": "Comcast",
    "server": {"id": 12345, "name": "Test Server", "location": "San Francisco, CA"},
    "result": {"url": "https://www.speedtest.net/result/123"},
})

SAMPLE_SERVER_LIST = json.dumps([
    {"id": 12345, "name": "Server A", "location": "San Francisco, CA", "latency": 5.2},
    {"id": 67890, "name": "Server B", "location": "Los Angeles, CA", "latency": 12.8},
])


@pytest.mark.asyncio
async def test_parse_result():
    runner = SpeedtestRunner()
    raw = json.loads(SAMPLE_CLI_OUTPUT)
    parsed = runner.parse_result(raw)
    assert parsed["download_mbps"] == pytest.approx(542.5, rel=0.01)
    assert parsed["upload_mbps"] == pytest.approx(128.3, rel=0.01)
    assert parsed["ping_ms"] == 12.1
    assert parsed["jitter_ms"] == 3.2
    assert parsed["server_id"] == 12345
    assert parsed["server_name"] == "Test Server"
    assert parsed["isp"] == "Comcast"


@pytest.mark.asyncio
async def test_run_test_returns_result():
    runner = SpeedtestRunner()

    mock_process = AsyncMock()
    mock_process.communicate = AsyncMock(return_value=(SAMPLE_CLI_OUTPUT.encode(), b""))
    mock_process.returncode = 0

    with patch("asyncio.create_subprocess_exec", return_value=mock_process):
        events = []
        async for event in runner.run_test():
            events.append(event)

    result_events = [e for e in events if e["type"] == "result"]
    assert len(result_events) == 1
    assert result_events[0]["data"]["download_mbps"] == pytest.approx(542.5, rel=0.01)


@pytest.mark.asyncio
async def test_list_servers():
    runner = SpeedtestRunner()

    mock_process = AsyncMock()
    mock_process.communicate = AsyncMock(return_value=(SAMPLE_SERVER_LIST.encode(), b""))
    mock_process.returncode = 0

    with patch("asyncio.create_subprocess_exec", return_value=mock_process):
        servers = await runner.list_servers()

    assert len(servers) == 2
    assert servers[0]["id"] == 12345


@pytest.mark.asyncio
async def test_is_running_prevents_concurrent():
    runner = SpeedtestRunner()
    assert runner.is_running is False
