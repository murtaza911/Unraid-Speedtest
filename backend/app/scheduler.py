from __future__ import annotations

import logging
from typing import Optional

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

    async def _run_scheduled_test(self, server_id: Optional[int] = None):
        logger.info("Running scheduled speed test")
        async for event in self.runner.run_test(server_id=server_id):
            if event["type"] == "result":
                await self.db.insert_result(**event["data"], triggered_by="scheduled")
                logger.info(f"Scheduled test complete: {event['data']['download_mbps']} Mbps down")
            elif event["type"] == "error":
                logger.error(f"Scheduled test failed: {event['data']['message']}")

    def shutdown(self):
        self._scheduler.shutdown(wait=False)
