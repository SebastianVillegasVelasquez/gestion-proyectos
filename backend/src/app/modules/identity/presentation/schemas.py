from typing import Annotated, Optional
from uuid import UUID

from pydantic import EmailStr, StringConstraints, field_validator

from app.modules.identity.infrastructure.enums import DocumentType, SystemRole
from app.shared.base_model import BaseModelConfig

# Documento de identidad: opcional, pero cuando viene lo normalizamos a una
# cadena corta sin espacios. `None`/"" se tratan como "sin documento".
DocumentNumber = Annotated[str, StringConstraints(min_length=3, max_length=32)]


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

    # Clave de un cargo existente en la tabla `positions` (ver PositionRepository).
    # Se valida contra la BD en el use case, no aquí: el catálogo es mutable.
    position: Annotated[str, StringConstraints(min_length=1, max_length=64)] = (
        "sin_cargo"
    )

    # Documento de identidad (opcional): tipo + número. El número, si viene, es
    # único en el sistema (se valida en el use case).
    document_type: Optional[DocumentType] = None
    document_number: Optional[DocumentNumber] = None

    @field_validator("document_number", mode="before")
    @classmethod
    def normalize_document(cls, v: object) -> Optional[str]:
        # Espacios en blanco cuentan como "sin documento" para no chocar contra
        # la unicidad con cadenas vacías.
        if v is None:
            return None
        cleaned = str(v).strip()
        return cleaned or None

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
    position: Annotated[str, StringConstraints(min_length=1, max_length=64)] | None = (
        None
    )
    document_type: Optional[DocumentType] = None
    document_number: Optional[DocumentNumber] = None

    @field_validator("document_number", mode="before")
    @classmethod
    def normalize_document(cls, v: object) -> Optional[str]:
        if v is None:
            return None
        cleaned = str(v).strip()
        return cleaned or None


class RefreshRequest(BaseModelConfig):
    refresh_token: str


class ChangePasswordRequest(BaseModelConfig):
    current_password: str
    new_password: Annotated[str, StringConstraints(min_length=8)]

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isdigit() for c in v):
            raise ValueError("La contraseña debe contener al menos un número")
        return v


class ResetPasswordResponse(BaseModelConfig):
    """Contraseña temporal generada por un admin para entregar al usuario."""

    user_id: UUID
    temporary_password: str


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
    position: str
    is_active: bool
    document_type: Optional[str] = None
    document_number: Optional[str] = None


class PaginatedUsersResponse(BaseModelConfig):
    """Página de usuarios COMPLETOS (con rol e is_active) para administración."""

    items: list[UserResponse]
    total: int
    page: int
    page_size: int


class PositionOption(BaseModelConfig):
    """Opción de cargo para poblar los selectores (value + etiqueta es-CO).

    Fuente de verdad: la tabla `positions` (mutable), no un enum estático.
    """

    value: str
    label: str


class CreatePositionRequest(BaseModelConfig):
    """Alta de un cargo nuevo que la empresa nunca había tenido.

    `key` es el identificador estable (minúsculas, snake_case) que queda
    referenciado desde `users.position`.
    """

    key: Annotated[
        str,
        StringConstraints(
            min_length=2,
            max_length=64,
            pattern=r"^[a-záéíóúñ][a-záéíóúñ0-9_]*$",
        ),
    ]
    label: Annotated[str, StringConstraints(min_length=2, max_length=150)]


class DirectoryUserResponse(BaseModelConfig):
    """Vista ligera para elegir responsables de tareas (filtrable por cargo)."""

    id: UUID
    name: str
    last_name: str
    email: str
    position: str
    document_type: Optional[str] = None
    document_number: Optional[str] = None


class PaginatedDirectoryResponse(BaseModelConfig):
    """Página de usuarios para los selectores (evita traer toda la tabla)."""

    items: list[DirectoryUserResponse]
    total: int
    page: int
    page_size: int


class TokenResponse(BaseModelConfig):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class MessageResponse(BaseModelConfig):
    message: str


class BulkUserRowError(BaseModelConfig):
    """Motivo por el que una fila del CSV no se pudo crear."""

    row: int
    email: str | None = None
    error: str


class BulkCreatedUser(BaseModelConfig):
    """Usuario creado desde el CSV. `temporary_password` solo viene informada
    cuando la fila no traía contraseña y el sistema la generó."""

    id: UUID
    email: str
    name: str
    last_name: str
    temporary_password: str | None = None


class BulkCreateUsersResponse(BaseModelConfig):
    """Resultado de la carga masiva: procesamos todas las filas válidas (best
    effort) y reportamos el resto con su motivo, en vez de rechazar el archivo
    completo por una fila mala."""

    created: list[BulkCreatedUser]
    failed: list[BulkUserRowError]
    total_rows: int
