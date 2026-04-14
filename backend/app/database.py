from __future__ import annotations

from typing import Optional

import aiosqlite


class Database:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self._conn: Optional[aiosqlite.Connection] = None

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

    async def list_results(self, server_id: Optional[int] = None, triggered_by: Optional[str] = None,
                           start_date: Optional[str] = None, end_date: Optional[str] = None,
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

    async def delete_all_results(self) -> int:
        cursor = await self._conn.execute("DELETE FROM test_results")
        await self._conn.commit()
        return cursor.rowcount

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

    async def update_scheduler_config(self, enabled: bool, interval_minutes: int, server_id: Optional[int]):
        await self._conn.execute(
            "UPDATE scheduler_config SET enabled = ?, interval_minutes = ?, server_id = ? WHERE id = 1",
            (int(enabled), interval_minutes, server_id),
        )
        await self._conn.commit()
