from __future__ import annotations

import asyncio
import json
from typing import AsyncGenerator, Optional


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

    async def run_test(self, server_id: Optional[int] = None) -> AsyncGenerator[dict, None]:
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

    async def list_servers(self) -> list:
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
