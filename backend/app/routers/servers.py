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
