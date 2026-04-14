# SpeedTest App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Dockerized speed test dashboard that wraps Ookla's `speedtest` CLI with a FastAPI backend and React frontend, supporting server selection with favorites, historical results with charts, and optional scheduled tests.

**Architecture:** Single Docker container with FastAPI serving both the REST API and built React static files. The backend shells out to the Ookla `speedtest` CLI, stores results in SQLite (volume-mounted at `/data`), and runs an optional APScheduler for recurring tests. The frontend is a React SPA with Recharts for data visualization and Tailwind for the dark minimal theme.

**Tech Stack:** Python 3.12, FastAPI, uvicorn, sse-starlette, APScheduler, aiosqlite; React 18, Vite, Tailwind CSS, Recharts, React Router

---

## File Structure

```
SpeedTestApp/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app, lifespan, static file serving
│   │   ├── database.py          # SQLite connection, schema init, query helpers
│   │   ├── speedtest_runner.py  # Wraps speedtest CLI, parses output, streams progress
│   │   ├── scheduler.py         # APScheduler setup, config persistence
│   │   └── routers/
│   │       ├── __init__.py
│   │       ├── speedtest.py     # /api/speedtest/run, /api/results endpoints
│   │       ├── servers.py       # /api/servers, /api/favorites endpoints
│   │       ├── scheduler.py     # /api/scheduler endpoints
│   │       └── health.py        # /api/health endpoint
│   ├── requirements.txt
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py          # Shared fixtures (test DB, app client)
│       ├── test_database.py
│       ├── test_speedtest_runner.py
│       ├── test_routers_speedtest.py
│       ├── test_routers_servers.py
│       └── test_routers_scheduler.py
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx             # React entry point
│       ├── App.jsx              # Router setup, layout shell
│       ├── api.js               # Fetch helpers for all API endpoints
│       ├── pages/
│       │   ├── Dashboard.jsx    # Run test, results cards, mini chart
│       │   ├── History.jsx      # Charts, filters, results table
│       │   └── Settings.jsx     # Favorites, scheduler, data management
│       └── components/
│           ├── NavBar.jsx       # Top navigation bar
│           ├── ServerSelector.jsx   # Dropdown with favorites + discovery
│           ├── TestProgress.jsx     # Live progress indicator during test
│           ├── ResultCards.jsx      # Download/upload/ping/jitter cards
│           ├── SpeedChart.jsx       # Recharts line chart for history
│           └── ResultsTable.jsx     # Sortable results table
├── Dockerfile
└── docker-compose.yml
```

---

### Task 1: Backend Project Setup & Database

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/app/__init__.py`
- Create: `backend/app/database.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_database.py`

- [ ] **Step 1: Create requirements.txt**

```
fastapi==0.115.12
uvicorn[standard]==0.34.2
sse-starlette==2.3.3
apscheduler==3.11.0
aiosqlite==0.21.0
httpx==0.28.1
pytest==8.3.5
pytest-asyncio==0.25.3
```

- [ ] **Step 2: Create virtual environment and install deps**

Run:
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

- [ ] **Step 3: Write database tests**

Create `backend/tests/__init__.py` (empty file).

Create `backend/tests/conftest.py`:

```python
import asyncio
import os
import tempfile

import pytest
import pytest_asyncio

from app.database import Database


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def db():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "test.db")
        database = Database(db_path)
        await database.init()
        yield database
        await database.close()
```

Create `backend/tests/test_database.py`:

```python
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
```

- [ ] **Step 4: Run tests to verify they fail**

Run:
```bash
cd backend && source venv/bin/activate && python -m pytest tests/test_database.py -v
```
Expected: FAIL — `app.database` module does not exist.

- [ ] **Step 5: Implement database module**

Create `backend/app/__init__.py` (empty file).

Create `backend/app/database.py`:

```python
import aiosqlite


class Database:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._conn: aiosqlite.Connection | None = None

    async def init(self):
        self._conn = await aiosqlite.connect(self.db_path)
        self._conn.row_factory = aiosqlite.Row
        await self._conn.executescript("""
            CREATE TABLE IF NOT EXISTS test_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                download_mbps REAL NOT NULL,
                upload_mbps REAL NOT NULL,
                ping_ms REAL NOT NULL,
                jitter_ms REAL NOT NULL,
                server_id INTEGER NOT NULL,
                server_name TEXT NOT NULL,
                server_location TEXT NOT NULL,
                isp TEXT NOT NULL,
                result_url TEXT NOT NULL,
                triggered_by TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS favorite_servers (
                server_id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                location TEXT NOT NULL,
                added_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS scheduler_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                enabled INTEGER NOT NULL DEFAULT 0,
                interval_minutes INTEGER NOT NULL DEFAULT 360,
                server_id INTEGER
            );

            INSERT OR IGNORE INTO scheduler_config (id) VALUES (1);
        """)
        await self._conn.commit()

    async def close(self):
        if self._conn:
            await self._conn.close()

    async def fetch_all(self, query: str, params: tuple = ()):
        cursor = await self._conn.execute(query, params)
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]

    async def fetch_one(self, query: str, params: tuple = ()):
        cursor = await self._conn.execute(query, params)
        row = await cursor.fetchone()
        return dict(row) if row else None

    async def insert_result(self, **kwargs) -> int:
        cursor = await self._conn.execute(
            """INSERT INTO test_results
               (timestamp, download_mbps, upload_mbps, ping_ms, jitter_ms,
                server_id, server_name, server_location, isp, result_url, triggered_by)
               VALUES (:timestamp, :download_mbps, :upload_mbps, :ping_ms, :jitter_ms,
                       :server_id, :server_name, :server_location, :isp, :result_url, :triggered_by)""",
            kwargs,
        )
        await self._conn.commit()
        return cursor.lastrowid

    async def get_result(self, result_id: int):
        return await self.fetch_one("SELECT * FROM test_results WHERE id = ?", (result_id,))

    async def list_results(self, server_id: int | None = None, triggered_by: str | None = None,
                           start_date: str | None = None, end_date: str | None = None,
                           limit: int = 100, offset: int = 0):
        query = "SELECT * FROM test_results WHERE 1=1"
        params = []
        if server_id is not None:
            query += " AND server_id = ?"
            params.append(server_id)
        if triggered_by is not None:
            query += " AND triggered_by = ?"
            params.append(triggered_by)
        if start_date is not None:
            query += " AND timestamp >= ?"
            params.append(start_date)
        if end_date is not None:
            query += " AND timestamp <= ?"
            params.append(end_date)
        query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        return await self.fetch_all(query, tuple(params))

    async def delete_result(self, result_id: int) -> bool:
        cursor = await self._conn.execute("DELETE FROM test_results WHERE id = ?", (result_id,))
        await self._conn.commit()
        return cursor.rowcount > 0

    async def add_favorite(self, server_id: int, name: str, location: str):
        await self._conn.execute(
            "INSERT OR REPLACE INTO favorite_servers (server_id, name, location) VALUES (?, ?, ?)",
            (server_id, name, location),
        )
        await self._conn.commit()

    async def list_favorites(self):
        return await self.fetch_all("SELECT * FROM favorite_servers ORDER BY added_at DESC")

    async def remove_favorite(self, server_id: int) -> bool:
        cursor = await self._conn.execute("DELETE FROM favorite_servers WHERE server_id = ?", (server_id,))
        await self._conn.commit()
        return cursor.rowcount > 0

    async def get_scheduler_config(self):
        row = await self.fetch_one("SELECT * FROM scheduler_config WHERE id = 1")
        return {
            "enabled": bool(row["enabled"]),
            "interval_minutes": row["interval_minutes"],
            "server_id": row["server_id"],
        }

    async def update_scheduler_config(self, enabled: bool, interval_minutes: int, server_id: int | None):
        await self._conn.execute(
            "UPDATE scheduler_config SET enabled = ?, interval_minutes = ?, server_id = ? WHERE id = 1",
            (int(enabled), interval_minutes, server_id),
        )
        await self._conn.commit()
```

- [ ] **Step 6: Run tests to verify they pass**

Run:
```bash
cd backend && source venv/bin/activate && python -m pytest tests/test_database.py -v
```
Expected: All 7 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/requirements.txt backend/app/ backend/tests/
git commit -m "feat: add database layer with SQLite schema and CRUD operations"
```

---

### Task 2: Speedtest CLI Runner

**Files:**
- Create: `backend/app/speedtest_runner.py`
- Create: `backend/tests/test_speedtest_runner.py`

- [ ] **Step 1: Write runner tests**

Create `backend/tests/test_speedtest_runner.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd backend && source venv/bin/activate && python -m pytest tests/test_speedtest_runner.py -v
```
Expected: FAIL — `app.speedtest_runner` does not exist.

- [ ] **Step 3: Implement speedtest runner**

Create `backend/app/speedtest_runner.py`:

```python
import asyncio
import json
from typing import AsyncGenerator


class SpeedtestRunner:
    def __init__(self):
        self._running = False

    @property
    def is_running(self) -> bool:
        return self._running

    def parse_result(self, raw: dict) -> dict:
        return {
            "timestamp": raw["timestamp"],
            "download_mbps": round(raw["download"]["bandwidth"] * 8 / 1_000_000, 2),
            "upload_mbps": round(raw["upload"]["bandwidth"] * 8 / 1_000_000, 2),
            "ping_ms": raw["ping"]["latency"],
            "jitter_ms": raw["ping"]["jitter"],
            "server_id": raw["server"]["id"],
            "server_name": raw["server"]["name"],
            "server_location": raw["server"]["location"],
            "isp": raw["isp"],
            "result_url": raw["result"]["url"],
        }

    async def run_test(self, server_id: int | None = None) -> AsyncGenerator[dict, None]:
        if self._running:
            yield {"type": "error", "data": {"message": "A test is already running"}}
            return

        self._running = True
        try:
            cmd = ["speedtest", "--format=json", "--accept-license", "--accept-gdpr"]
            if server_id is not None:
                cmd.extend(["--server-id", str(server_id)])

            yield {"type": "status", "data": {"phase": "connecting"}}

            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await process.communicate()

            if process.returncode != 0:
                yield {"type": "error", "data": {"message": f"speedtest failed: {stderr.decode().strip()}"}}
                return

            raw = json.loads(stdout.decode())
            parsed = self.parse_result(raw)
            yield {"type": "result", "data": parsed}
        finally:
            self._running = False

    async def list_servers(self) -> list[dict]:
        process = await asyncio.create_subprocess_exec(
            "speedtest", "--servers", "--format=json", "--accept-license", "--accept-gdpr",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await process.communicate()
        servers = json.loads(stdout.decode())

        if isinstance(servers, dict) and "servers" in servers:
            servers = servers["servers"]

        return [
            {
                "id": s["id"],
                "name": s["name"],
                "location": s["location"],
                "latency": s.get("latency"),
            }
            for s in servers
        ]
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd backend && source venv/bin/activate && python -m pytest tests/test_speedtest_runner.py -v
```
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/speedtest_runner.py backend/tests/test_speedtest_runner.py
git commit -m "feat: add speedtest CLI runner with JSON parsing and concurrency guard"
```

---

### Task 3: API Routers — Health & Speedtest

**Files:**
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/routers/health.py`
- Create: `backend/app/routers/speedtest.py`
- Create: `backend/app/main.py`
- Create: `backend/tests/test_routers_speedtest.py`

- [ ] **Step 1: Write router tests**

Create `backend/tests/test_routers_speedtest.py`:

```python
import json
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, AsyncMock

from app.main import create_app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest_asyncio.fixture
async def client(db):
    app = create_app(db)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


import pytest_asyncio


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
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd backend && source venv/bin/activate && python -m pytest tests/test_routers_speedtest.py -v
```
Expected: FAIL — modules don't exist yet.

- [ ] **Step 3: Implement routers and main app**

Create `backend/app/routers/__init__.py` (empty file).

Create `backend/app/routers/health.py`:

```python
from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
async def health():
    return {"status": "ok"}
```

Create `backend/app/routers/speedtest.py`:

```python
from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse
import json

router = APIRouter(prefix="/api", tags=["speedtest"])


@router.get("/speedtest/run")
async def run_speedtest(request: Request, server_id: int | None = Query(None)):
    runner = request.app.state.runner
    db = request.app.state.db

    if runner.is_running:
        return JSONResponse(status_code=409, content={"detail": "A test is already running"})

    async def event_stream():
        async for event in runner.run_test(server_id=server_id):
            if event["type"] == "result":
                await db.insert_result(**event["data"], triggered_by="manual")
            yield {"event": event["type"], "data": json.dumps(event["data"])}

    return EventSourceResponse(event_stream())


@router.get("/results")
async def list_results(
    request: Request,
    server_id: int | None = Query(None),
    triggered_by: str | None = Query(None),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    db = request.app.state.db
    results = await db.list_results(
        server_id=server_id, triggered_by=triggered_by,
        start_date=start_date, end_date=end_date,
        limit=limit, offset=offset,
    )
    return results


@router.get("/results/{result_id}")
async def get_result(request: Request, result_id: int):
    db = request.app.state.db
    result = await db.get_result(result_id)
    if result is None:
        return JSONResponse(status_code=404, content={"detail": "Result not found"})
    return result


@router.delete("/results/{result_id}")
async def delete_result(request: Request, result_id: int):
    db = request.app.state.db
    deleted = await db.delete_result(result_id)
    if not deleted:
        return JSONResponse(status_code=404, content={"detail": "Result not found"})
    return {"status": "deleted"}
```

Create `backend/app/main.py`:

```python
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.database import Database
from app.speedtest_runner import SpeedtestRunner
from app.routers import health, speedtest, servers, scheduler as scheduler_router


def create_app(db: Database | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if app.state.db_owner:
            await app.state.db.init()
        yield
        if app.state.db_owner:
            await app.state.db.close()

    app = FastAPI(title="SpeedTest App", lifespan=lifespan)

    if db is not None:
        app.state.db = db
        app.state.db_owner = False
    else:
        data_dir = os.environ.get("DATA_DIR", "/data")
        os.makedirs(data_dir, exist_ok=True)
        app.state.db = Database(os.path.join(data_dir, "speedtest.db"))
        app.state.db_owner = True

    app.state.runner = SpeedtestRunner()

    app.include_router(health.router)
    app.include_router(speedtest.router)
    app.include_router(servers.router)
    app.include_router(scheduler_router.router)

    # Serve frontend static files (mounted last so API routes take precedence)
    static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
    if os.path.isdir(static_dir):
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

    return app
```

- [ ] **Step 4: Create stub routers for servers and scheduler**

These are needed so `main.py` imports don't fail. Full implementation comes in the next tasks.

Create `backend/app/routers/servers.py`:

```python
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api", tags=["servers"])


@router.get("/servers")
async def list_servers(request: Request):
    runner = request.app.state.runner
    servers = await runner.list_servers()
    return servers


@router.get("/favorites")
async def list_favorites(request: Request):
    db = request.app.state.db
    return await db.list_favorites()


@router.post("/favorites")
async def add_favorite(request: Request):
    body = await request.json()
    db = request.app.state.db
    await db.add_favorite(
        server_id=body["server_id"],
        name=body["name"],
        location=body["location"],
    )
    return {"status": "added"}


@router.delete("/favorites/{server_id}")
async def remove_favorite(request: Request, server_id: int):
    db = request.app.state.db
    deleted = await db.remove_favorite(server_id)
    if not deleted:
        return JSONResponse(status_code=404, content={"detail": "Favorite not found"})
    return {"status": "removed"}
```

Create `backend/app/routers/scheduler.py`:

```python
from fastapi import APIRouter, Request

router = APIRouter(prefix="/api", tags=["scheduler"])


@router.get("/scheduler")
async def get_scheduler_config(request: Request):
    db = request.app.state.db
    return await db.get_scheduler_config()


@router.put("/scheduler")
async def update_scheduler_config(request: Request):
    body = await request.json()
    db = request.app.state.db
    await db.update_scheduler_config(
        enabled=body["enabled"],
        interval_minutes=body["interval_minutes"],
        server_id=body.get("server_id"),
    )

    scheduler = getattr(request.app.state, "scheduler_service", None)
    if scheduler:
        config = await db.get_scheduler_config()
        scheduler.apply_config(config)

    return await db.get_scheduler_config()
```

- [ ] **Step 5: Update conftest to provide app client**

Update `backend/tests/conftest.py` to add the `client` fixture used by router tests:

```python
import asyncio
import os
import tempfile

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.database import Database
from app.main import create_app


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def db():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "test.db")
        database = Database(db_path)
        await database.init()
        yield database
        await database.close()


@pytest_asyncio.fixture
async def client(db):
    app = create_app(db)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
```

- [ ] **Step 6: Run all tests**

Run:
```bash
cd backend && source venv/bin/activate && python -m pytest tests/ -v
```
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/ backend/tests/
git commit -m "feat: add FastAPI app with health, speedtest, servers, and scheduler routers"
```

---

### Task 4: Scheduler Service

**Files:**
- Create: `backend/app/scheduler.py`
- Create: `backend/tests/test_routers_scheduler.py`

- [ ] **Step 1: Write scheduler router tests**

Create `backend/tests/test_routers_scheduler.py`:

```python
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.main import create_app


@pytest_asyncio.fixture
async def client(db):
    app = create_app(db)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


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
```

- [ ] **Step 2: Run tests to verify they pass**

These should already pass since the scheduler router was created in Task 3.

Run:
```bash
cd backend && source venv/bin/activate && python -m pytest tests/test_routers_scheduler.py -v
```
Expected: All tests PASS.

- [ ] **Step 3: Implement scheduler service**

Create `backend/app/scheduler.py`:

```python
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.database import Database
from app.speedtest_runner import SpeedtestRunner

logger = logging.getLogger(__name__)


class SchedulerService:
    def __init__(self, db: Database, runner: SpeedtestRunner):
        self.db = db
        self.runner = runner
        self._scheduler = AsyncIOScheduler()
        self._job_id = "scheduled_speedtest"

    async def start(self):
        config = await self.db.get_scheduler_config()
        self._scheduler.start()
        self.apply_config(config)

    def apply_config(self, config: dict):
        existing = self._scheduler.get_job(self._job_id)
        if existing:
            self._scheduler.remove_job(self._job_id)

        if config["enabled"]:
            self._scheduler.add_job(
                self._run_scheduled_test,
                "interval",
                minutes=config["interval_minutes"],
                id=self._job_id,
                kwargs={"server_id": config["server_id"]},
            )
            logger.info(f"Scheduler enabled: every {config['interval_minutes']} minutes")
        else:
            logger.info("Scheduler disabled")

    async def _run_scheduled_test(self, server_id: int | None = None):
        logger.info("Running scheduled speed test")
        async for event in self.runner.run_test(server_id=server_id):
            if event["type"] == "result":
                await self.db.insert_result(**event["data"], triggered_by="scheduled")
                logger.info(f"Scheduled test complete: {event['data']['download_mbps']} Mbps down")
            elif event["type"] == "error":
                logger.error(f"Scheduled test failed: {event['data']['message']}")

    def shutdown(self):
        self._scheduler.shutdown(wait=False)
```

- [ ] **Step 4: Wire scheduler into main.py lifespan**

Update `backend/app/main.py` — replace the lifespan and add the scheduler import:

```python
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.database import Database
from app.speedtest_runner import SpeedtestRunner
from app.scheduler import SchedulerService
from app.routers import health, speedtest, servers, scheduler as scheduler_router


def create_app(db: Database | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if app.state.db_owner:
            await app.state.db.init()
            sched = SchedulerService(app.state.db, app.state.runner)
            app.state.scheduler_service = sched
            await sched.start()
        yield
        if app.state.db_owner:
            if hasattr(app.state, "scheduler_service"):
                app.state.scheduler_service.shutdown()
            await app.state.db.close()

    app = FastAPI(title="SpeedTest App", lifespan=lifespan)

    if db is not None:
        app.state.db = db
        app.state.db_owner = False
    else:
        data_dir = os.environ.get("DATA_DIR", "/data")
        os.makedirs(data_dir, exist_ok=True)
        app.state.db = Database(os.path.join(data_dir, "speedtest.db"))
        app.state.db_owner = True

    app.state.runner = SpeedtestRunner()

    app.include_router(health.router)
    app.include_router(speedtest.router)
    app.include_router(servers.router)
    app.include_router(scheduler_router.router)

    static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
    if os.path.isdir(static_dir):
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

    return app
```

- [ ] **Step 5: Run all backend tests**

Run:
```bash
cd backend && source venv/bin/activate && python -m pytest tests/ -v
```
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/scheduler.py backend/app/main.py backend/tests/
git commit -m "feat: add APScheduler service for optional recurring speed tests"
```

---

### Task 5: Frontend Project Setup

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.jsx`
- Create: `frontend/src/App.jsx`
- Create: `frontend/src/index.css`
- Create: `frontend/src/api.js`

- [ ] **Step 1: Initialize frontend project**

Create `frontend/package.json`:

```json
{
  "name": "speedtest-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^7.5.0",
    "recharts": "^2.15.3"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.4.1",
    "autoprefixer": "^10.4.21",
    "postcss": "^8.5.3",
    "tailwindcss": "^3.4.17",
    "vite": "^6.3.2"
  }
}
```

- [ ] **Step 2: Create Vite config**

Create `frontend/vite.config.js`:

```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8080",
    },
  },
  build: {
    outDir: "../backend/static",
    emptyOutDir: true,
  },
});
```

- [ ] **Step 3: Create Tailwind config**

Create `frontend/tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

Create `frontend/postcss.config.js`:

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 4: Create index.html**

Create `frontend/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SpeedTest</title>
  </head>
  <body class="bg-slate-900 text-slate-200">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create CSS entry point**

Create `frontend/src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: system-ui, -apple-system, sans-serif;
}
```

- [ ] **Step 6: Create API helper**

Create `frontend/src/api.js`:

```js
const BASE = "/api";

export async function fetchResults(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}/results${query ? "?" + query : ""}`);
  return res.json();
}

export async function deleteResult(id) {
  const res = await fetch(`${BASE}/results/${id}`, { method: "DELETE" });
  return res.json();
}

export function runSpeedtest(serverId, onEvent) {
  const url = serverId
    ? `${BASE}/speedtest/run?server_id=${serverId}`
    : `${BASE}/speedtest/run`;

  const eventSource = new EventSource(url);

  eventSource.addEventListener("status", (e) => {
    onEvent({ type: "status", data: JSON.parse(e.data) });
  });

  eventSource.addEventListener("result", (e) => {
    onEvent({ type: "result", data: JSON.parse(e.data) });
    eventSource.close();
  });

  eventSource.addEventListener("error", (e) => {
    if (e.data) {
      onEvent({ type: "error", data: JSON.parse(e.data) });
    }
    eventSource.close();
  });

  return () => eventSource.close();
}

export async function fetchServers() {
  const res = await fetch(`${BASE}/servers`);
  return res.json();
}

export async function fetchFavorites() {
  const res = await fetch(`${BASE}/favorites`);
  return res.json();
}

export async function addFavorite(server) {
  const res = await fetch(`${BASE}/favorites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(server),
  });
  return res.json();
}

export async function removeFavorite(serverId) {
  const res = await fetch(`${BASE}/favorites/${serverId}`, { method: "DELETE" });
  return res.json();
}

export async function fetchScheduler() {
  const res = await fetch(`${BASE}/scheduler`);
  return res.json();
}

export async function updateScheduler(config) {
  const res = await fetch(`${BASE}/scheduler`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  return res.json();
}
```

- [ ] **Step 7: Create main entry point and App shell**

Create `frontend/src/main.jsx`:

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

Create `frontend/src/App.jsx`:

```jsx
import { Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Settings from "./pages/Settings";

function NavBar() {
  const linkClass = ({ isActive }) =>
    `px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? "bg-slate-800 text-sky-400"
        : "text-slate-500 hover:text-slate-300"
    }`;

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
      <div className="flex items-center gap-6">
        <span className="text-lg font-bold text-slate-100 tracking-tight">
          SpeedTest
        </span>
        <div className="flex gap-1">
          <NavLink to="/" end className={linkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/history" className={linkClass}>
            History
          </NavLink>
          <NavLink to="/settings" className={linkClass}>
            Settings
          </NavLink>
        </div>
      </div>
      <span className="text-xs text-slate-600">Unraid Server</span>
    </nav>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <NavBar />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
```

- [ ] **Step 8: Create placeholder pages**

Create `frontend/src/pages/Dashboard.jsx`:

```jsx
export default function Dashboard() {
  return <div>Dashboard placeholder</div>;
}
```

Create `frontend/src/pages/History.jsx`:

```jsx
export default function History() {
  return <div>History placeholder</div>;
}
```

Create `frontend/src/pages/Settings.jsx`:

```jsx
export default function Settings() {
  return <div>Settings placeholder</div>;
}
```

- [ ] **Step 9: Install deps and verify dev server starts**

Run:
```bash
cd frontend && npm install && npm run dev -- --host 0.0.0.0 &
sleep 3 && curl -s http://localhost:5173 | head -20
kill %1
```
Expected: HTML output with `<div id="root">`.

- [ ] **Step 10: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold React frontend with Vite, Tailwind, routing, and API helpers"
```

---

### Task 6: Dashboard Page

**Files:**
- Create: `frontend/src/components/ServerSelector.jsx`
- Create: `frontend/src/components/TestProgress.jsx`
- Create: `frontend/src/components/ResultCards.jsx`
- Modify: `frontend/src/pages/Dashboard.jsx`

- [ ] **Step 1: Create ServerSelector component**

Create `frontend/src/components/ServerSelector.jsx`:

```jsx
import { useState, useEffect } from "react";
import { fetchFavorites, fetchServers } from "../api";

export default function ServerSelector({ value, onChange }) {
  const [favorites, setFavorites] = useState([]);
  const [allServers, setAllServers] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFavorites().then(setFavorites).catch(() => {});
  }, []);

  const handleBrowse = async () => {
    if (allServers.length === 0) {
      setLoading(true);
      try {
        const servers = await fetchServers();
        setAllServers(servers);
      } catch {
        // silently fail
      }
      setLoading(false);
    }
    setShowAll(true);
  };

  return (
    <div className="flex-1 relative">
      <label className="block text-[11px] text-slate-500 uppercase tracking-wider mb-1">
        Server
      </label>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 appearance-none cursor-pointer focus:outline-none focus:border-sky-500"
      >
        <option value="">Auto (Best Server)</option>
        {favorites.length > 0 && (
          <optgroup label="Favorites">
            {favorites.map((s) => (
              <option key={s.server_id} value={s.server_id}>
                {s.name} — {s.location}
              </option>
            ))}
          </optgroup>
        )}
        {showAll && allServers.length > 0 && (
          <optgroup label="All Servers">
            {allServers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.location}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      {!showAll && (
        <button
          onClick={handleBrowse}
          disabled={loading}
          className="mt-2 text-xs text-sky-400 hover:text-sky-300 transition-colors"
        >
          {loading ? "Loading servers..." : "Browse all servers..."}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create TestProgress component**

Create `frontend/src/components/TestProgress.jsx`:

```jsx
export default function TestProgress({ phase }) {
  if (!phase) return null;

  const phases = ["connecting", "download", "upload"];
  const currentIdx = phases.indexOf(phase);

  return (
    <div className="bg-slate-800 rounded-xl p-6 mb-8">
      <div className="flex items-center gap-8">
        {phases.map((p, i) => (
          <div key={p} className="flex items-center gap-3">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                i < currentIdx
                  ? "bg-emerald-400"
                  : i === currentIdx
                  ? "bg-sky-400 animate-pulse"
                  : "bg-slate-600"
              }`}
            />
            <span
              className={`text-sm capitalize ${
                i === currentIdx
                  ? "text-slate-200 font-medium"
                  : "text-slate-500"
              }`}
            >
              {p === "connecting" ? "Connecting" : `Testing ${p}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create ResultCards component**

Create `frontend/src/components/ResultCards.jsx`:

```jsx
export default function ResultCards({ result }) {
  if (!result) return null;

  const cards = [
    { label: "Download", value: result.download_mbps, unit: "Mbps", color: "text-sky-400" },
    { label: "Upload", value: result.upload_mbps, unit: "Mbps", color: "text-violet-400" },
    { label: "Ping", value: result.ping_ms, unit: "ms", color: "text-emerald-400" },
    { label: "Jitter", value: result.jitter_ms, unit: "ms", color: "text-amber-400" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-slate-800 rounded-xl p-5 text-center"
        >
          <div className="text-[11px] text-slate-500 uppercase tracking-widest mb-2">
            {card.label}
          </div>
          <div className={`text-4xl font-bold ${card.color} leading-none`}>
            {typeof card.value === "number" ? card.value.toFixed(1) : "—"}
          </div>
          <div className="text-sm text-slate-500 mt-1">{card.unit}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Implement Dashboard page**

Replace `frontend/src/pages/Dashboard.jsx`:

```jsx
import { useState, useEffect, useCallback } from "react";
import { runSpeedtest, fetchResults } from "../api";
import ServerSelector from "../components/ServerSelector";
import TestProgress from "../components/TestProgress";
import ResultCards from "../components/ResultCards";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function Dashboard() {
  const [serverId, setServerId] = useState(null);
  const [testing, setTesting] = useState(false);
  const [phase, setPhase] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [recentResults, setRecentResults] = useState([]);

  const loadRecent = useCallback(async () => {
    try {
      const results = await fetchResults({ limit: 10 });
      setRecentResults(results);
      if (results.length > 0 && !lastResult) {
        setLastResult(results[0]);
      }
    } catch {
      // ignore
    }
  }, [lastResult]);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const handleRunTest = () => {
    setTesting(true);
    setPhase("connecting");

    runSpeedtest(serverId, (event) => {
      if (event.type === "status") {
        setPhase(event.data.phase);
      } else if (event.type === "result") {
        setLastResult(event.data);
        setTesting(false);
        setPhase(null);
        loadRecent();
      } else if (event.type === "error") {
        setTesting(false);
        setPhase(null);
      }
    });
  };

  const chartData = [...recentResults]
    .reverse()
    .map((r) => ({
      date: new Date(r.timestamp).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      download: r.download_mbps,
    }));

  return (
    <div>
      {/* Server selector + Run button */}
      <div className="flex items-end gap-4 mb-8">
        <ServerSelector value={serverId} onChange={setServerId} />
        <button
          onClick={handleRunTest}
          disabled={testing}
          className={`px-8 py-2.5 rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${
            testing
              ? "bg-slate-700 text-slate-400 cursor-not-allowed"
              : "bg-sky-400 text-slate-900 hover:bg-sky-300"
          }`}
        >
          {testing ? "Running..." : "Run Test"}
        </button>
      </div>

      {/* Progress indicator */}
      {testing && <TestProgress phase={phase} />}

      {/* Result cards */}
      <ResultCards result={lastResult} />

      {/* Mini history chart */}
      {chartData.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-5">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-semibold text-slate-200">
              Recent History
            </span>
            <a
              href="/history"
              className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
            >
              View All →
            </a>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={chartData}>
              <XAxis
                dataKey="date"
                tick={{ fill: "#475569", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  color: "#e2e8f0",
                  fontSize: 13,
                }}
                formatter={(val) => [`${val} Mbps`, "Download"]}
              />
              <Bar
                dataKey="download"
                fill="#38bdf8"
                radius={[4, 4, 0, 0]}
                opacity={0.8}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verify it compiles**

Run:
```bash
cd frontend && npm run build
```
Expected: Build succeeds, output in `backend/static/`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/
git commit -m "feat: implement Dashboard page with server selector, test runner, result cards, and mini chart"
```

---

### Task 7: History Page

**Files:**
- Create: `frontend/src/components/SpeedChart.jsx`
- Create: `frontend/src/components/ResultsTable.jsx`
- Modify: `frontend/src/pages/History.jsx`

- [ ] **Step 1: Create SpeedChart component**

Create `frontend/src/components/SpeedChart.jsx`:

```jsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function SpeedChart({ data }) {
  const chartData = [...data].reverse().map((r) => ({
    date: new Date(r.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    time: new Date(r.timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
    download: r.download_mbps,
    upload: r.upload_mbps,
    ping: r.ping_ms,
  }));

  return (
    <div className="bg-slate-800 rounded-xl p-5 mb-6">
      <h3 className="text-sm font-semibold text-slate-200 mb-4">
        Speed Over Time
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData}>
          <XAxis
            dataKey="date"
            tick={{ fill: "#475569", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#475569", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip
            contentStyle={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: 8,
              color: "#e2e8f0",
              fontSize: 13,
            }}
            labelFormatter={(label, payload) => {
              if (payload?.[0]?.payload?.time) {
                return `${label} ${payload[0].payload.time}`;
              }
              return label;
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "#94a3b8" }}
          />
          <Line
            type="monotone"
            dataKey="download"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={false}
            name="Download (Mbps)"
          />
          <Line
            type="monotone"
            dataKey="upload"
            stroke="#a78bfa"
            strokeWidth={2}
            dot={false}
            name="Upload (Mbps)"
          />
          <Line
            type="monotone"
            dataKey="ping"
            stroke="#34d399"
            strokeWidth={2}
            dot={false}
            name="Ping (ms)"
            yAxisId="right"
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: "#475569", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Create ResultsTable component**

Create `frontend/src/components/ResultsTable.jsx`:

```jsx
import { useState } from "react";

export default function ResultsTable({ results, onDelete }) {
  const [expandedId, setExpandedId] = useState(null);

  return (
    <div className="bg-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_0.8fr] px-4 py-3 text-[11px] text-slate-500 uppercase tracking-wider border-b border-slate-700">
        <span>Date</span>
        <span>Server</span>
        <span>Download</span>
        <span>Upload</span>
        <span>Ping</span>
        <span>Type</span>
      </div>

      {/* Rows */}
      {results.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-slate-500">
          No results yet. Run a speed test to get started.
        </div>
      )}
      {results.map((r) => (
        <div key={r.id}>
          <div
            onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
            className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_0.8fr] px-4 py-3 text-sm border-b border-slate-700/50 cursor-pointer hover:bg-slate-750 transition-colors"
          >
            <span className="text-slate-400">
              {new Date(r.timestamp).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            <span className="text-slate-200 truncate">
              {r.server_name}
            </span>
            <span className="text-sky-400">{r.download_mbps.toFixed(1)} Mbps</span>
            <span className="text-violet-400">{r.upload_mbps.toFixed(1)} Mbps</span>
            <span className="text-emerald-400">{r.ping_ms.toFixed(1)} ms</span>
            <span className="text-[11px] text-slate-500 capitalize">
              {r.triggered_by}
            </span>
          </div>
          {expandedId === r.id && (
            <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700/50 flex items-center gap-6 text-sm">
              <span className="text-slate-400">
                ISP: <span className="text-slate-200">{r.isp}</span>
              </span>
              <span className="text-slate-400">
                Jitter: <span className="text-amber-400">{r.jitter_ms.toFixed(1)} ms</span>
              </span>
              <span className="text-slate-400">
                Location: <span className="text-slate-200">{r.server_location}</span>
              </span>
              {r.result_url && (
                <a
                  href={r.result_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:text-sky-300"
                >
                  Ookla Result →
                </a>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(r.id);
                }}
                className="ml-auto text-red-400 hover:text-red-300 text-xs"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Implement History page**

Replace `frontend/src/pages/History.jsx`:

```jsx
import { useState, useEffect } from "react";
import { fetchResults, deleteResult } from "../api";
import SpeedChart from "../components/SpeedChart";
import ResultsTable from "../components/ResultsTable";

export default function History() {
  const [results, setResults] = useState([]);
  const [serverFilter, setServerFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("30");

  const loadResults = async () => {
    const params = { limit: 500 };
    if (serverFilter) params.server_id = serverFilter;
    if (typeFilter) params.triggered_by = typeFilter;
    if (dateFilter) {
      const d = new Date();
      d.setDate(d.getDate() - Number(dateFilter));
      params.start_date = d.toISOString();
    }
    try {
      const data = await fetchResults(params);
      setResults(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadResults();
  }, [serverFilter, typeFilter, dateFilter]);

  const handleDelete = async (id) => {
    await deleteResult(id);
    loadResults();
  };

  const uniqueServers = [
    ...new Map(results.map((r) => [r.server_id, { id: r.server_id, name: r.server_name }])).values(),
  ];

  return (
    <div>
      <SpeedChart data={results} />

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={serverFilter}
          onChange={(e) => setServerFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-400 focus:outline-none focus:border-sky-500"
        >
          <option value="">All Servers</option>
          {uniqueServers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-400 focus:outline-none focus:border-sky-500"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="">All time</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-400 focus:outline-none focus:border-sky-500"
        >
          <option value="">All Types</option>
          <option value="manual">Manual</option>
          <option value="scheduled">Scheduled</option>
        </select>
      </div>

      <ResultsTable results={results} onDelete={handleDelete} />
    </div>
  );
}
```

- [ ] **Step 4: Verify it compiles**

Run:
```bash
cd frontend && npm run build
```
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: implement History page with speed charts, filters, and results table"
```

---

### Task 8: Settings Page

**Files:**
- Modify: `frontend/src/pages/Settings.jsx`

- [ ] **Step 1: Implement Settings page**

Replace `frontend/src/pages/Settings.jsx`:

```jsx
import { useState, useEffect } from "react";
import {
  fetchFavorites,
  removeFavorite,
  fetchServers,
  addFavorite,
  fetchScheduler,
  updateScheduler,
  fetchResults,
} from "../api";

export default function Settings() {
  const [favorites, setFavorites] = useState([]);
  const [scheduler, setScheduler] = useState({
    enabled: false,
    interval_minutes: 360,
    server_id: null,
  });
  const [allServers, setAllServers] = useState([]);
  const [loadingServers, setLoadingServers] = useState(false);
  const [showServerPicker, setShowServerPicker] = useState(false);

  useEffect(() => {
    fetchFavorites().then(setFavorites).catch(() => {});
    fetchScheduler().then(setScheduler).catch(() => {});
  }, []);

  const handleRemoveFavorite = async (serverId) => {
    await removeFavorite(serverId);
    setFavorites(favorites.filter((f) => f.server_id !== serverId));
  };

  const handleAddServer = async () => {
    if (allServers.length === 0) {
      setLoadingServers(true);
      try {
        const servers = await fetchServers();
        setAllServers(servers);
      } catch {
        // ignore
      }
      setLoadingServers(false);
    }
    setShowServerPicker(true);
  };

  const handlePickServer = async (server) => {
    await addFavorite({
      server_id: server.id,
      name: server.name,
      location: server.location,
    });
    const updated = await fetchFavorites();
    setFavorites(updated);
    setShowServerPicker(false);
  };

  const handleSchedulerChange = async (changes) => {
    const newConfig = { ...scheduler, ...changes };
    const result = await updateScheduler(newConfig);
    setScheduler(result);
  };

  const handleExportCSV = async () => {
    const results = await fetchResults({ limit: 10000 });
    if (results.length === 0) return;

    const headers = [
      "timestamp",
      "download_mbps",
      "upload_mbps",
      "ping_ms",
      "jitter_ms",
      "server_name",
      "server_location",
      "isp",
      "triggered_by",
    ];
    const csv = [
      headers.join(","),
      ...results.map((r) =>
        headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `speedtest-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const intervalOptions = [
    { label: "1 hour", value: 60 },
    { label: "3 hours", value: 180 },
    { label: "6 hours", value: 360 },
    { label: "12 hours", value: 720 },
    { label: "24 hours", value: 1440 },
  ];

  return (
    <div className="space-y-8">
      {/* Favorites */}
      <section>
        <h2 className="text-lg font-semibold text-slate-100 mb-4">
          Favorite Servers
        </h2>
        <div className="bg-slate-800 rounded-xl overflow-hidden">
          {favorites.length === 0 && (
            <div className="px-4 py-6 text-sm text-slate-500 text-center">
              No favorite servers yet.
            </div>
          )}
          {favorites.map((f) => (
            <div
              key={f.server_id}
              className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50"
            >
              <div>
                <span className="text-sm text-slate-200">{f.name}</span>
                <span className="text-xs text-slate-500 ml-2">
                  {f.location}
                </span>
              </div>
              <button
                onClick={() => handleRemoveFavorite(f.server_id)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={handleAddServer}
          disabled={loadingServers}
          className="mt-3 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-sky-400 hover:border-sky-500 transition-colors"
        >
          {loadingServers ? "Loading..." : "Add Server"}
        </button>

        {/* Server picker modal */}
        {showServerPicker && (
          <div className="mt-3 bg-slate-800 border border-slate-700 rounded-xl max-h-64 overflow-y-auto">
            {allServers.map((s) => (
              <div
                key={s.id}
                onClick={() => handlePickServer(s)}
                className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/50 cursor-pointer hover:bg-slate-750 transition-colors"
              >
                <div>
                  <span className="text-sm text-slate-200">{s.name}</span>
                  <span className="text-xs text-slate-500 ml-2">
                    {s.location}
                  </span>
                </div>
                {s.latency && (
                  <span className="text-xs text-slate-500">
                    {s.latency.toFixed(1)} ms
                  </span>
                )}
              </div>
            ))}
            <div className="px-4 py-2">
              <button
                onClick={() => setShowServerPicker(false)}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Scheduler */}
      <section>
        <h2 className="text-lg font-semibold text-slate-100 mb-4">
          Scheduled Tests
        </h2>
        <div className="bg-slate-800 rounded-xl p-5 space-y-4">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-200">
              Run tests automatically
            </span>
            <button
              onClick={() =>
                handleSchedulerChange({ enabled: !scheduler.enabled })
              }
              className={`relative w-11 h-6 rounded-full transition-colors ${
                scheduler.enabled ? "bg-sky-500" : "bg-slate-600"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  scheduler.enabled ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>

          {/* Interval */}
          {scheduler.enabled && (
            <>
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Run every
                </label>
                <select
                  value={scheduler.interval_minutes}
                  onChange={(e) =>
                    handleSchedulerChange({
                      interval_minutes: Number(e.target.value),
                    })
                  }
                  className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                >
                  {intervalOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Server for scheduled tests */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Test server
                </label>
                <select
                  value={scheduler.server_id || ""}
                  onChange={(e) =>
                    handleSchedulerChange({
                      server_id: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                  className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500"
                >
                  <option value="">Auto (Best Server)</option>
                  {favorites.map((f) => (
                    <option key={f.server_id} value={f.server_id}>
                      {f.name} — {f.location}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Data Management */}
      <section>
        <h2 className="text-lg font-semibold text-slate-100 mb-4">
          Data Management
        </h2>
        <div className="flex gap-3">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 hover:border-sky-500 transition-colors"
          >
            Export CSV
          </button>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run:
```bash
cd frontend && npm run build
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Settings.jsx
git commit -m "feat: implement Settings page with favorites, scheduler toggle, and CSV export"
```

---

### Task 9: Dockerfile & Docker Compose

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`

- [ ] **Step 1: Create Dockerfile**

Create `Dockerfile`:

```dockerfile
# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Stage 2: Python backend
FROM python:3.12-slim

# Install Ookla speedtest CLI
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl gnupg && \
    curl -s https://packagecloud.io/install/repositories/ookla/speedtest-cli/script.deb.sh | bash && \
    apt-get install -y --no-install-recommends speedtest && \
    apt-get purge -y curl gnupg && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/app/ app/

# Copy built frontend from stage 1
COPY --from=frontend-build /app/backend/static/ static/

# Create data directory
RUN mkdir -p /data

ENV PORT=8080
ENV DATA_DIR=/data

EXPOSE 8080

CMD ["python", "-m", "uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8080"]
```

- [ ] **Step 2: Create docker-compose.yml**

Create `docker-compose.yml`:

```yaml
services:
  speedtest:
    build: .
    container_name: speedtest
    ports:
      - "8080:8080"
    volumes:
      - speedtest-data:/data
    environment:
      - TZ=America/Los_Angeles
    restart: unless-stopped

volumes:
  speedtest-data:
```

- [ ] **Step 3: Verify Docker build**

Run:
```bash
docker build -t speedtest-app .
```
Expected: Build completes without errors.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile docker-compose.yml
git commit -m "feat: add Dockerfile and docker-compose for Unraid deployment"
```

---

### Task 10: Final Integration Test

- [ ] **Step 1: Run all backend tests**

Run:
```bash
cd backend && source venv/bin/activate && python -m pytest tests/ -v
```
Expected: All tests PASS.

- [ ] **Step 2: Run frontend build**

Run:
```bash
cd frontend && npm run build
```
Expected: Build succeeds with output in `backend/static/`.

- [ ] **Step 3: Docker build and smoke test**

Run:
```bash
docker compose up -d
sleep 5
curl -s http://localhost:8080/api/health
curl -s http://localhost:8080 | head -5
docker compose down
```
Expected: Health returns `{"status":"ok"}`, index.html is served.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final integration verification"
```
