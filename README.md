# Unraid-Speedtest

A self-hosted speed test dashboard that wraps Ookla's official `speedtest` CLI with a web UI. Run tests, track results over time with charts, save favorite servers, and optionally schedule recurring tests.

Built for Unraid but runs anywhere Docker does.

![Dashboard](https://img.shields.io/badge/stack-FastAPI%20%2B%20React-blue)
![Docker](https://img.shields.io/badge/deploy-Docker-2496ED)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **Run speed tests** from the browser with a live animated progress ring showing real-time download/upload speeds
- **Server selection** with auto-discovery and saved favorites for quick access
- **Historical tracking** with line charts (download, upload, ping over time) and a paginated results table
- **Scheduled tests** — optional recurring tests on a configurable interval (1hr to 24hr)
- **Stop tests** mid-run if needed
- **Export results** as CSV
- **Dark minimal UI** — clean slate/blue/purple theme

## Quick Start

### Docker Compose (recommended)

```bash
git clone https://github.com/murtaza911/Unraid-Speedtest.git
cd Unraid-Speedtest
docker compose up -d
```

Open **http://your-server-ip:8080**

### Docker Run

```bash
docker build -t unraid-speedtest .
docker run -d \
  --name speedtest \
  -p 8080:8080 \
  -v /path/to/data:/data \
  -e TZ=America/New_York \
  unraid-speedtest
```

### Unraid (recommended)

1. Open the Unraid terminal and run:
   ```bash
   wget -O /boot/config/plugins/dockerMan/templates-user/unraid-speedtest.xml https://raw.githubusercontent.com/murtaza911/Unraid-Speedtest/main/unraid-template.xml
   ```
2. Go to **Docker** tab > **Add Container**
3. Select **Unraid-Speedtest** from the **Template** dropdown
4. Configure the port, data path, and timezone using the familiar Unraid edit UI
5. Click **Apply**

This gives you the standard Unraid settings panel where you can change the port, data directory, and timezone without editing any files. The template persists across reboots.

**Alternative — Docker Compose:**

```bash
git clone https://github.com/murtaza911/Unraid-Speedtest.git
cd Unraid-Speedtest
docker compose up -d
```

The SQLite database is stored at `/data/speedtest.db` inside the container. Mount a volume to persist results across container restarts:

```yaml
volumes:
  - /mnt/user/appdata/unraid-speedtest:/data
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | `8080` | Web server port |
| `TZ` | `UTC` | Timezone for timestamps |
| `DATA_DIR` | `/data` | Directory for the SQLite database |

## Architecture

Single Docker container, no external dependencies:

```
Docker Container
├── React frontend (built at image build time, served as static files)
├── FastAPI backend (REST API + SSE for live progress)
├── Ookla speedtest CLI (installed from official repo at build time)
└── SQLite database (persisted via volume mount)
```

The Ookla `speedtest` CLI is installed inside the container automatically — you do not need to install it on your host.

## Development

To run locally for development:

**Backend:**

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
DATA_DIR=/tmp/speedtest-dev uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8080
```

**Frontend (with hot reload):**

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server runs on port 5173 and proxies API calls to the backend on port 8080.

**Note:** Local development requires the [Ookla speedtest CLI](https://www.speedtest.net/apps/cli) installed on your machine.

**Tests:**

```bash
cd backend
source venv/bin/activate
pytest tests/ -v
```

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/speedtest/run` | Run a speed test (SSE stream with live progress) |
| POST | `/api/speedtest/stop` | Stop a running test |
| GET | `/api/results` | List results (supports `limit`, `offset`, `server_id`, `start_date`, `end_date`, `triggered_by`) |
| DELETE | `/api/results` | Delete all results |
| DELETE | `/api/results/{id}` | Delete a single result |
| GET | `/api/servers` | Discover nearby servers |
| GET | `/api/favorites` | List favorite servers |
| POST | `/api/favorites` | Add a favorite |
| DELETE | `/api/favorites/{id}` | Remove a favorite |
| GET | `/api/scheduler` | Get scheduler config |
| PUT | `/api/scheduler` | Update scheduler config |
| GET | `/api/health` | Health check |

## Tech Stack

**Backend:** Python 3.12, FastAPI, uvicorn, aiosqlite, APScheduler, sse-starlette

**Frontend:** React 18, Vite, Tailwind CSS, Recharts, React Router

**Infrastructure:** Docker (multi-stage build), SQLite, Ookla speedtest CLI
