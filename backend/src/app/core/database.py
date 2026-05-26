from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)


# ── Engine ─────────────────────────────────────────────────────────────────────
def build_engine():
    from app.core.config import get_settings

    settings = get_settings()
    return create_async_engine(
        settings.DATABASE_URL,
        echo=settings.IS_DEV,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
    )


# ── Session factory ────────────────────────────────────────────────────────────
AsyncSessionLocal = async_sessionmaker(
    bind=build_engine(),
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ── Dependency para FastAPI ────────────────────────────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
