import pytest

from app.core.security import create_access_token, hash_password
from app.modules.identity.infrastructure.enums import UserPosition
from app.modules.identity.infrastructure.models import User, SystemRole


@pytest.fixture
async def admin_user(db_session):
    user = User(
        email="admin@test.com",
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


@pytest.fixture
async def admin_token(admin_user):
    token = create_access_token(
        user_id=admin_user.id,
        role=admin_user.role.value,
    )

    return token


@pytest.fixture
async def member_user(db_session):
    user = User(
        email="member@test.com",
        password=hash_password("Member123*"),
        name="Member",
        last_name="Test",
        role=SystemRole.USER,
        position=UserPosition.DESARROLLADOR,
        is_active=True,
    )

    db_session.add(user)

    await db_session.commit()
    await db_session.refresh(user)

    return user


@pytest.fixture
async def member_token(member_user):
    return create_access_token(
        user_id=member_user.id,
        role=member_user.role.value,
    )


@pytest.fixture
async def super_admin_user(db_session):
    user = User(
        email="superadmin@test.com",
        password=hash_password("SuperAdmin123*"),
        name="Super",
        last_name="Admin",
        role=SystemRole.SUPER_ADMIN,
        position=UserPosition.DESARROLLADOR,
        is_active=True,
    )

    db_session.add(user)

    await db_session.commit()
    await db_session.refresh(user)

    return user


@pytest.fixture
async def super_admin_token(super_admin_user):
    token = create_access_token(
        user_id=super_admin_user.id,
        role=super_admin_user.role.value,
    )

    return token


@pytest.fixture
async def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def super_admin_headers(super_admin_token):
    return {"Authorization": f"Bearer {super_admin_token}"}


@pytest.fixture
async def member_headers(member_token):
    return {"Authorization": f"Bearer {member_token}"}
