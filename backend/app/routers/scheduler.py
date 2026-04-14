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
