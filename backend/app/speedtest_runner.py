from __future__ import annotations

import asyncio
import json
import logging
from typing import AsyncGenerator, Optional

logger = logging.getLogger(__name__)


class SpeedtestRunner:
    def __init__(self):
        self._running = False
        self._process: Optional[asyncio.subprocess.Process] = None

    @property
    def is_running(self) -> bool:
        return self._running

    async def stop_test(self):
        if self._process and self._running:
            try:
                self._process.terminate()
                await asyncio.wait_for(self._process.wait(), timeout=5)
            except asyncio.TimeoutError:
                self._process.kill()
            self._running = False

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

    def _parse_progress_line(self, raw: dict) -> Optional[dict]:
        """Parse a single JSON progress line from the speedtest CLI."""
        msg_type = raw.get("type")

        if msg_type == "testStart":
            server = raw.get("server", {})
            return {
                "type": "status",
                "data": {
                    "phase": "connecting",
                    "server_name": server.get("name", ""),
                    "server_location": server.get("location", ""),
                },
            }
        elif msg_type == "ping":
            ping = raw.get("ping", {})
            return {
                "type": "progress",
                "data": {
                    "phase": "ping",
                    "progress": ping.get("progress", 0),
                    "latency": ping.get("latency", 0),
                    "jitter": ping.get("jitter", 0),
                },
            }
        elif msg_type == "download":
            dl = raw.get("download", {})
            return {
                "type": "progress",
                "data": {
                    "phase": "download",
                    "progress": dl.get("progress", 0),
                    "speed_mbps": round(dl.get("bandwidth", 0) * 8 / 1_000_000, 2),
                },
            }
        elif msg_type == "upload":
            ul = raw.get("upload", {})
            return {
                "type": "progress",
                "data": {
                    "phase": "upload",
                    "progress": ul.get("progress", 0),
                    "speed_mbps": round(ul.get("bandwidth", 0) * 8 / 1_000_000, 2),
                },
            }
        elif msg_type == "result":
            parsed = self.parse_result(raw)
            return {"type": "result", "data": parsed}

        return None

    async def run_test(self, server_id: Optional[int] = None) -> AsyncGenerator[dict, None]:
        if self._running:
            yield {"type": "error", "data": {"message": "A test is already running"}}
            return

        self._running = True
        try:
            cmd = [
                "speedtest", "--format=json",
                "--progress=yes", "--accept-license", "--accept-gdpr",
            ]
            if server_id is not None:
                cmd.extend(["--server-id", str(server_id)])

            yield {"type": "status", "data": {"phase": "connecting"}}

            self._process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            # Read stdout line by line for progress updates
            buffer = ""
            while self._running:
                chunk = await self._process.stdout.read(4096)
                if not chunk:
                    break
                buffer += chunk.decode()

                # Try to parse complete JSON objects from the buffer
                while buffer.strip():
                    try:
                        raw = json.loads(buffer)
                        event = self._parse_progress_line(raw)
                        if event:
                            yield event
                        buffer = ""
                        break
                    except json.JSONDecodeError:
                        newline_idx = buffer.find("\n")
                        if newline_idx == -1:
                            break  # Need more data
                        line = buffer[:newline_idx].strip()
                        buffer = buffer[newline_idx + 1:]
                        if not line:
                            continue
                        try:
                            raw = json.loads(line)
                            event = self._parse_progress_line(raw)
                            if event:
                                yield event
                        except json.JSONDecodeError:
                            logger.debug("Skipping unparseable line: %s", line[:100])

            await self._process.wait()

            if not self._running:
                yield {"type": "stopped", "data": {"message": "Test stopped"}}
            elif self._process.returncode != 0:
                stderr = await self._process.stderr.read()
                yield {"type": "error", "data": {"message": f"speedtest failed: {stderr.decode().strip()}"}}
        finally:
            self._process = None
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
