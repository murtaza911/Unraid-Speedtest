# SpeedTest App — Design Spec

A self-hosted speed test dashboard that runs Ookla's `speedtest` CLI on an Unraid server, wrapped in a polished web UI with historical tracking and charts.

## Architecture

Single Docker container running two processes:

- **FastAPI backend** — wraps the `speedtest` CLI, manages SQLite DB, serves the REST API, runs the optional scheduler via APScheduler
- **React frontend** — built at Docker build time (multi-stage), served as static files by FastAPI

```
┌─────────────────────────────────┐
│         Docker Container        │
│                                 │
│  ┌──────────┐   ┌────────────┐  │
│  │  React   │   │  FastAPI   │  │
│  │ (static) │◄──│  Backend   │  │
│  └──────────┘   └─────┬──────┘  │
│                       │         │
│                 ┌─────┴──────┐  │
│                 │ speedtest  │  │
│                 │    CLI     │  │
│                 └────────────┘  │
│                                 │
│  ┌────────────────────────────┐ │
│  │  /data/speedtest.db (vol)  │ │
│  └────────────────────────────┘ │
└─────────────────────────────────┘
```

- Single exposed port (default `8080`, configurable via `PORT` env var)
- SQLite database at `/data/speedtest.db`, persisted via Docker volume mount
- Ookla `speedtest` CLI installed from official package repo at build time

## API Design

### Speed Tests

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/speedtest/run` | SSE endpoint — kicks off a test, streams progress events (connecting, testing download, testing upload), then sends the final result. Stores result in DB on completion. Accepts optional `server_id` query param. Only one test may run at a time — returns 409 if a test is already in progress. |
| GET | `/api/results` | List all past results, newest first. Query params: `server_id`, `start_date`, `end_date`, `triggered_by`, `limit`, `offset`. |
| GET | `/api/results/{id}` | Single result detail. |
| DELETE | `/api/results/{id}` | Delete a specific result. |

### Servers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/servers` | Runs `speedtest --servers` to discover nearby servers. Returns list with id, name, location, latency. |
| GET | `/api/favorites` | List saved favorite servers. |
| POST | `/api/favorites` | Add a server to favorites. Body: `{ server_id, name, location }`. |
| DELETE | `/api/favorites/{id}` | Remove a server from favorites. |

### Scheduler

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/scheduler` | Get current scheduler config (enabled, interval_minutes, server_id). |
| PUT | `/api/scheduler` | Update scheduler settings. Body: `{ enabled, interval_minutes, server_id }`. |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Container health check. Returns `{ status: "ok" }`. |

### SSE Progress Events

The `/api/speedtest/run` endpoint streams events in this sequence:

```
event: status
data: {"phase": "connecting", "server": "Comcast - San Francisco, CA"}

event: status
data: {"phase": "download", "progress": 45.2}

event: status
data: {"phase": "upload", "progress": 78.1}

event: result
data: { ...full test result object... }
```

## Data Model

### `test_results`

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| timestamp | DATETIME | When the test ran (UTC) |
| download_mbps | REAL | Download speed in Mbps |
| upload_mbps | REAL | Upload speed in Mbps |
| ping_ms | REAL | Latency in ms |
| jitter_ms | REAL | Ping jitter in ms |
| server_id | INTEGER | Ookla server ID |
| server_name | TEXT | Server display name |
| server_location | TEXT | City/region |
| isp | TEXT | Detected ISP |
| result_url | TEXT | Ookla result link |
| triggered_by | TEXT | "manual" or "scheduled" |

### `favorite_servers`

| Column | Type | Description |
|--------|------|-------------|
| server_id | INTEGER PK | Ookla server ID |
| name | TEXT | Display name |
| location | TEXT | City/region |
| added_at | DATETIME | When favorited |

### `scheduler_config` (single-row)

| Column | Type | Description |
|--------|------|-------------|
| enabled | BOOLEAN | Scheduler on/off |
| interval_minutes | INTEGER | Run interval (default 360 = 6 hours) |
| server_id | INTEGER NULL | Server to test against (null = auto-select best) |

## Frontend

### Tech Stack

- React (Vite for build tooling)
- Recharts for charts
- Tailwind CSS for styling
- React Router for navigation

### Visual Style

Dark minimal theme:
- Background: slate-900 (`#0f172a`)
- Card surfaces: slate-800 (`#1e293b`)
- Borders: slate-700 (`#334155`)
- Primary text: slate-200 (`#e2e8f0`)
- Secondary text: slate-500 (`#64748b`)
- Accent colors:
  - Download: sky-400 (`#38bdf8`)
  - Upload: violet-400 (`#a78bfa`)
  - Ping: emerald-400 (`#34d399`)
  - Jitter: amber-400 (`#fbbf24`)

### Views

#### Dashboard (Home)

- **Server selector**: dropdown with favorites pinned at top, divider, "Browse all servers..." opens full discovery list
- **Run Test button**: prominent, primary action
- **Live progress area**: shows current test phase with animated indicator while a test runs
- **Result cards**: download, upload, ping, jitter — large numbers, color-coded
- **Mini history chart**: bar chart of recent download speeds with "View All →" link to History

#### History

- **Line charts**: download, upload, and ping over time on a shared time axis. Toggleable series via legend clicks.
- **Filter controls**: server dropdown, date range picker, manual/scheduled filter
- **Results table**: timestamp, server, download, upload, ping, triggered_by — sortable columns
- **Row click**: expands to show full detail (ISP, jitter, Ookla result link)

#### Settings

- **Favorites management**: list of saved servers with remove buttons. "Add Server" triggers server discovery and lets user pick servers to favorite.
- **Scheduler**: on/off toggle, interval selector (preset options: 1hr, 3hr, 6hr, 12hr, 24hr, plus custom minutes input), server selector for which server to test.
- **Data management**: export all results as CSV, clear all history (with confirmation dialog).

## Docker

### Multi-stage build

1. **Node stage** (`node:20-alpine`): installs frontend deps, builds React app via Vite
2. **Python stage** (`python:3.12-slim`): installs Ookla `speedtest` CLI from official apt repo, installs Python deps, copies built frontend static files from Node stage

### Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| PORT | 8080 | Server port |
| TZ | UTC | Timezone for timestamps |

### Volumes

| Path | Purpose |
|------|---------|
| /data | SQLite database persistence |

### Example Unraid deployment

```bash
docker run -d \
  --name speedtest \
  -p 8080:8080 \
  -v /mnt/user/appdata/speedtest:/data \
  -e TZ=America/Los_Angeles \
  speedtest-app
```

## Key Dependencies

### Backend (Python)
- `fastapi` — web framework
- `uvicorn` — ASGI server
- `sse-starlette` — Server-Sent Events support
- `apscheduler` — scheduled test execution
- `aiosqlite` — async SQLite access

### Frontend (JavaScript)
- `react` + `react-dom` — UI framework
- `react-router-dom` — client-side routing
- `recharts` — charting library
- `tailwindcss` — utility CSS
- `vite` — build tool

### System
- `speedtest` — Ookla's official CLI (installed in container)
