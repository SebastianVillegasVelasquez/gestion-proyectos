from typing import Annotated
from uuid import UUID

from pydantic import EmailStr, StringConstraints, field_validator

from app.modules.identity.infrastructure.enums import UserPosition, SystemRole
from app.shared.base_model import BaseModelConfig


class LoginRequest(BaseModelConfig):
    email: EmailStr

    password: Annotated[
        str,
        StringConstraints(min_length=1),
    ]


class CreateUserRequest(BaseModelConfig):
    email: EmailStr

    password: Annotated[
        str,
        StringConstraints(min_length=8),
    ]

    name: Annotated[
        str,
        StringConstraints(min_length=2, max_length=200),
    ]

    last_name: Annotated[
        str,
        StringConstraints(min_length=2, max_length=200),
    ]

    role: SystemRole = SystemRole.USER

    position: UserPosition = UserPosition.SIN_CARGO

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isdigit() for c in v):
            raise ValueError("La contraseña debe contener al menos un número")
        return v


class UpdateUserRequest(BaseModelConfig):
    email: EmailStr

    name: Annotated[
        str,
        StringConstraints(min_length=2, max_length=200),
    ]

    last_name: Annotated[
        str,
        StringConstraints(min_length=2, max_length=200),
    ]

    role: SystemRole | None = None
    is_active: bool | None = None


class RefreshRequest(BaseModelConfig):
    refresh_token: str


class UserResponse(BaseModelConfig):
    id: UUID
    email: str

    name: Annotated[
        str,
        StringConstraints(min_length=2, max_length=200),
    ]

    last_name: Annotated[
        str,
        StringConstraints(min_length=2, max_length=200),
    ]

    role: SystemRole
    is_active: bool


class TokenResponse(BaseModelConfig):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class MessageResponse(BaseModelConfig):
    message: str
