from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse
import json

router = APIRouter(prefix="/api", tags=["speedtest"])


@router.get("/speedtest/run")
async def run_speedtest(request: Request, server_id: Optional[int] = Query(None)):
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
    server_id: Optional[int] = Query(None),
    triggered_by: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
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
