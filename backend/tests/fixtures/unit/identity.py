from dataclasses import dataclass
from uuid import UUID

import pytest

from app.modules.identity.infrastructure.enums import UserRole
from app.modules.identity.presentation.schemas import CreateUserRequest


@dataclass
class FakeUser:
    id: UUID
    email: str
    name: str
    last_name: str
    role: UserRole
    is_active: bool


class FakeIdentityRepository:
    def __init__(self, users: list[CreateUserRequest] | None = None):
        self.users = users or []
        self.saved_users: list[CreateUserRequest] = []

    async def get_user_by_email(self, email: str) -> CreateUserRequest | None:
        return next((u for u in self.users if u.email == email), None)

    async def is_email_available(self, email: str) -> bool:
        return not any(u.email == email for u in self.users)

    async def add(self, user: CreateUserRequest) -> FakeUser:
        self.saved_users.append(user)
        return FakeUser(
            id=UUID(int=1),
            email=user.email,
            name=user.name,
            last_name=user.last_name,
            role=user.role,
            is_active=True,
        )


@pytest.fixture
def build_identity_repository():
    def _make(users: list[CreateUserRequest] | None = None):
        return FakeIdentityRepository(users=users)

    return _make


@pytest.fixture
def existing_users() -> list[CreateUserRequest]:
    return [
        CreateUserRequest(
            email="existing@test.com",
            password="secret123",
            name="Ana",
            last_name="García",
        )
    ]


@pytest.fixture
def fake_users() -> list[CreateUserRequest]:
    return [
        CreateUserRequest(email="", password="", name="Test", last_name="User"),
        CreateUserRequest(email="", password="", name="Test2", last_name="User2"),
    ]
