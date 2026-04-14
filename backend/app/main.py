from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.database import Database
from app.speedtest_runner import SpeedtestRunner
from app.scheduler import SchedulerService
from app.routers import health, speedtest, servers, scheduler as scheduler_router


def create_app(db: Optional[Database] = None) -> FastAPI:
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

    # Serve frontend static files (mounted last so API routes take precedence)
    static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
    if os.path.isdir(static_dir):
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

    return app
