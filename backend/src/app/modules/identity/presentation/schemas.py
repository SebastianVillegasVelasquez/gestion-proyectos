from datetime import datetime
from enum import Enum
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

    # Opcional: si el admin no la define, el sistema genera una contraseña
    # temporal y se la entrega para que el usuario la cambie en su primer ingreso.
    password: Annotated[str, StringConstraints(min_length=8)] | None = None

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

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: object) -> str:
        # El correo es el identificador único de la persona: sin normalizar,
        # "Test@x.com" y "test@x.com" pasarían como dos usuarios distintos.
        return str(v).strip().lower()

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
    # Permite a un admin exigir o levantar el cambio de contraseña del próximo
    # ingreso de una cuenta concreta (None = no se toca).
    must_change_password: bool | None = None

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: object) -> str:
        return str(v).strip().lower()

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
    # Fecha de alta de la cuenta. Opcional porque algunas respuestas (p. ej.
    # el login) se arman a mano; la administración de usuarios sí la envía.
    created_at: Optional[datetime] = None
    # Primer ingreso: mientras sea True el frontend obliga a cambiar la clave
    # con un modal antes de dejar usar la plataforma. Default False para no
    # romper respuestas armadas a mano de flujos que no lo necesitan.
    must_change_password: bool = False


class CreatedUserResponse(UserResponse):
    """Respuesta del alta de un usuario.

    El alta ya no entrega una contraseña: cuando el admin no define una, se
    devuelve ``activation_url`` (enlace de un solo uso que el sistema también
    envió por correo) por si el correo no llega. ``temporary_password`` queda
    como campo heredado, siempre ``None`` en el flujo actual.
    """

    temporary_password: Optional[str] = None
    activation_url: Optional[str] = None


class ActivateAccountRequest(BaseModelConfig):
    """Activación de cuenta: el token del enlace + la contraseña que elige la
    persona (misma política de fuerza que el cambio de contraseña)."""

    token: str
    new_password: Annotated[str, StringConstraints(min_length=8)]

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isdigit() for c in v):
            raise ValueError("La contraseña debe contener al menos un número")
        return v


class ActivationInfoResponse(BaseModelConfig):
    """A quién pertenece un enlace de activación (para la pantalla de alta)."""

    email: str
    name: str


class ActivationLinkResponse(BaseModelConfig):
    """Enlace de activación regenerado por un admin."""

    activation_url: Optional[str] = None
    expires_at: datetime


class AdminUserSortField(str, Enum):
    """Columnas ordenables de la tabla de administración de usuarios.

    Es un enum (y no un string libre) para que FastAPI rechace con 422 lo que
    no sea una columna válida, en vez de dejar que llegue al ORDER BY.
    """

    NAME = "name"
    EMAIL = "email"
    ROLE = "role"
    POSITION = "position"
    STATUS = "status"
    CREATED_AT = "created_at"


class SortDirection(str, Enum):
    ASC = "asc"
    DESC = "desc"


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

    Quien lo crea solo escribe el cargo en texto plano, tal cual se lee
    ("Diseñador Gráfico"): la clave estable que referencia `users.position`
    la deriva el backend (minúsculas, sin tildes, snake_case). Así la UI no
    le pide al administrador un concepto técnico que no le aporta nada.
    """

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


class SeenReleasesResponse(BaseModelConfig):
    """Ids de novedades ("what's new") que el usuario ya vio."""

    release_ids: list[str] = []


class MarkReleasesSeenRequest(BaseModelConfig):
    """Ids de novedades a marcar como vistas (idempotente)."""

    release_ids: list[str] = []
