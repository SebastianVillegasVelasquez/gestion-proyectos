from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.modules.identity.infrastructure.models import UserRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class CreateUserRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, description="Mínimo 8 caracteres")
    name: str = Field(min_length=2, max_length=200)
    last_name: str = Field(min_length=2, max_length=200)
    role: UserRole = UserRole.MEMBER

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isdigit() for c in v):
            raise ValueError("La contraseña debe contener al menos un número")
        return v


class UpdateUserRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=200)
    role: UserRole | None = None
    is_active: bool | None = None


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: UUID
    email: str
    name: str
    last_name: str
    role: UserRole
    is_active: bool

    model_config = {"from_attributes": True}  # permite crear desde ORM objects


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class MessageResponse(BaseModel):
    message: str
