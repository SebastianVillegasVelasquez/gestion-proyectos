from uuid import uuid4

import pytest_asyncio

from app.core.security import hash_password
from app.modules.identity.infrastructure.enums import UserPosition
from app.modules.identity.infrastructure.models import User, SystemRole


@pytest_asyncio.fixture
async def admin_user(db_session):
    user = User(
        email=f"admin-{uuid4()}@test.com",
        password=hash_password("Admin123*"),
        name="Admin",
        last_name="Test",
        role=SystemRole.ADMIN,
        position=UserPosition.DESARROLLADOR,
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
        password=hash_password("User123*"),
        name="Juan",
        last_name="García",
        role=SystemRole.USER,
        position=UserPosition.DESARROLLADOR,
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
        password=hash_password("User123*"),
        name="Pedro",
        last_name="Lopez",
        role=SystemRole.USER,
        position=UserPosition.DESARROLLADOR,
        is_active=True,
    )

    db_session.add(user)

    await db_session.commit()
    await db_session.refresh(user)

    return user
