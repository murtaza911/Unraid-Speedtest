import asyncio
import os
import tempfile

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.database import Database
from app.main import create_app


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def db():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "test.db")
        database = Database(db_path)
        await database.init()
        yield database
        await database.close()


@pytest_asyncio.fixture
async def client(db):
    app = create_app(db)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        c.app = app  # expose app for patching in tests
        yield c
