from pathlib import Path

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import NullPool, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import get_settings

from app.core.database import get_db
from main import app


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_database():
    import os
    import subprocess

    ROOT_DIR = Path(__file__).resolve().parents[3]

    ALEMBIC_INI = ROOT_DIR / "alembic.ini"

    os.environ["TESTING"] = "1"

    os.environ["DATABASE_HOST"] = "localhost"
    os.environ["DATABASE_PORT"] = "5433"
    os.environ["DATABASE_NAME"] = "db_test"
    os.environ["DATABASE_USER"] = "postgres"
    os.environ["DATABASE_PASSWORD"] = "postgres"

    get_settings.cache_clear()

    result = subprocess.run(
        [
            "alembic",
            "-c",
            str(ALEMBIC_INI),
            "upgrade",
            "head",
        ],
        capture_output=True,
        text=True,
    )

    print(result.stdout)
    print(result.stderr)

    result.check_returncode()

    yield


@pytest_asyncio.fixture(scope="session")
async def test_engine():
    engine = create_async_engine(
        get_settings().DATABASE_URL,
        poolclass=NullPool,
    )

    yield engine

    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine):
    async_session = async_sessionmaker(
        bind=test_engine,
        expire_on_commit=False,
    )

    async with async_session() as session:
        yield session

        await session.rollback()


@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client

    app.dependency_overrides.clear()


@pytest_asyncio.fixture(autouse=True)
async def clean_database(db_session):
    yield

    tables = [
        "users",
        "projects",
        "project_statuses",
    ]

    for table in tables:
        await db_session.execute(
            text(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE")
        )

    await db_session.commit()
