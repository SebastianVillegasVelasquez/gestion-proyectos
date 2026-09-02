from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List
from uuid import UUID

import pytest

from app.modules.identity.infrastructure.enums import SystemRole
from app.modules.identity.presentation.schemas import CreateUserRequest


@dataclass
class FakeUser:
    id: UUID
    email: str
    name: str
    last_name: str
    role: SystemRole
    is_active: bool
    position: str = "sin_cargo"
    document_type: str | None = None
    document_number: str | None = None
    # Espeja `TimestampMixin` del modelo real: las respuestas de usuario
    # incluyen la fecha de alta.
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    # Espeja las columnas del token de activación (alta sin contraseña).
    activation_token_hash: str | None = None
    activation_token_expires_at: datetime | None = None


class FakeIdentityRepository:
    def __init__(self, users: list[CreateUserRequest] | None = None):
        self.users = users or []
        self.saved_users: list[CreateUserRequest] = []
        self._by_id: dict = {}

    async def get_user_by_email(self, email: str) -> CreateUserRequest | None:
        return next((u for u in self.users if u.email == email), None)

    async def is_email_available(self, email: str) -> bool:
        return not any(u.email == email for u in self.users)

    async def is_document_available(self, document_number: str) -> bool:
        return not any(
            getattr(u, "document_number", None) == document_number for u in self.users
        )

    async def add(self, user: CreateUserRequest) -> FakeUser:
        self.saved_users.append(user)
        created = FakeUser(
            id=UUID(int=len(self.saved_users)),
            email=user.email,
            name=user.name,
            last_name=user.last_name,
            role=user.role,
            is_active=True,
            position=user.position,
            document_type=(user.document_type.value if user.document_type else None),
            document_number=user.document_number,
        )
        self._by_id[created.id] = created
        return created

    # ── Soporte del flujo de activación por token ──────────────────────────────
    async def get_by_id(self, user_id: UUID):
        return self._by_id.get(user_id)

    async def get_by_activation_token_hash(self, token_hash: str):
        return next(
            (u for u in self._by_id.values() if u.activation_token_hash == token_hash),
            None,
        )

    async def save(self, user) -> None:
        self._by_id[user.id] = user

    async def rollback(self) -> None:  # red de seguridad del caso de uso masivo
        return None


@pytest.fixture
def build_identity_repository():
    def _make(users: list[CreateUserRequest] | None = None):
        return FakeIdentityRepository(users=users)

    return _make


class FakePositionRepository:
    """Todas las claves pasadas al constructor existen; el resto no."""

    def __init__(self, existing_keys: list[str] | None = None):
        self.existing_keys = set(existing_keys or ["sin_cargo", "desarrollador"])
        self.added_keys: list[str] = []

    async def key_exists(self, key: str) -> bool:
        return key in self.existing_keys

    async def add(self, position):
        self.existing_keys.add(position.key)
        self.added_keys.append(position.key)
        return position


@pytest.fixture
def build_position_repository():
    def _make(existing_keys: list[str] | None = None):
        return FakePositionRepository(existing_keys=existing_keys)

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


@pytest.fixture
def fake_user() -> CreateUserRequest:
    return CreateUserRequest(
        email="existing@test.com",
        password="secret123",
        name="Ana",
        last_name="García",
    )


@pytest.fixture
def fake_members_payload() -> List[CreateUserRequest]:
    return [
        CreateUserRequest(
            email="ana.garcia@test.com",
            password="secret123",
            name="Ana",
            last_name="García",
        ),
        CreateUserRequest(
            email="juan.perez@test.com",
            password="secret123",
            name="Juan",
            last_name="Pérez",
        ),
        CreateUserRequest(
            email="maria.lopez@test.com",
            password="secret123",
            name="María",
            last_name="López",
        ),
        CreateUserRequest(
            email="carlos.rodriguez@test.com",
            password="secret123",
            name="Carlos",
            last_name="Rodríguez",
        ),
        CreateUserRequest(
            email="laura.martinez@test.com",
            password="secret123",
            name="Laura",
            last_name="Martínez",
        ),
    ]
