from uuid import uuid4

import pytest_asyncio

from app.core.security import hash_password
from app.modules.identity.infrastructure.models import User, UserRole


@pytest_asyncio.fixture
async def admin_user(db_session):
    user = User(
        email=f"admin-{uuid4()}@test.com",
        hashed_password=hash_password("Admin123*"),
        name="Admin",
        last_name="Test",
        role=UserRole.ADMIN,
        is_active=True,
    )

    db_session.add(user)

    await db_session.commit()
    await db_session.refresh(user)

    return user


@pytest_asyncio.fixture
async def created_user(db_session):
    user = User(
        email=f"user-{uuid4()}@test.com",
        hashed_password=hash_password("User123*"),
        name="Juan",
        last_name="García",
        role=UserRole.MEMBER,
        is_active=True,
    )

    db_session.add(user)

    await db_session.commit()
    await db_session.refresh(user)

    return user


@pytest_asyncio.fixture
async def second_user(db_session):
    user = User(
        email=f"second-{uuid4()}@test.com",
        hashed_password=hash_password("User123*"),
        name="Pedro",
        last_name="Lopez",
        role=UserRole.MEMBER,
        is_active=True,
    )

    db_session.add(user)

    await db_session.commit()
    await db_session.refresh(user)

    return user
