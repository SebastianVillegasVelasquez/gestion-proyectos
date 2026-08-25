from datetime import datetime, timezone
from uuid import UUID

from jose import JWTError

import logging
import re
import secrets
import string

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from pydantic import ValidationError

from app.modules.identity.domain.services import UserService
from app.modules.identity.infrastructure.enums import DocumentType, SystemRole
from app.modules.identity.infrastructure.models import Position
from app.modules.identity.presentation.schemas import (
    BulkCreatedUser,
    BulkCreateUsersResponse,
    BulkUserRowError,
    CreatePositionRequest,
    CreateUserRequest,
    DirectoryUserResponse,
    PaginatedDirectoryResponse,
    PaginatedUsersResponse,
    PositionOption,
    ResetPasswordResponse,
    TokenResponse,
    UpdateUserRequest,
    UserResponse,
)
from app.modules.identity.infrastructure.repository import (
    PositionRepository,
    UserRepository,
)
from app.shared.events import EventBus
from app.shared.events.events import UserCreated
from app.shared.exceptions import ConflictError, NotFoundError, UnauthorizedError
from app.shared.pagination import Pagination


logger = logging.getLogger(__name__)


def _generate_temp_password(length: int = 12) -> str:
    """Contraseña temporal legible con al menos una letra y un dígito."""
    alphabet = string.ascii_letters + string.digits
    while True:
        pwd = "".join(secrets.choice(alphabet) for _ in range(length))
        if any(c.isdigit() for c in pwd) and any(c.isalpha() for c in pwd):
            return pwd


# Solo mapeamos vocales con tilde/diéresis: la ñ NO se toca porque en español
# es una letra distinta de la "n" (año/ano), no una "n" acentuada.
_ACCENTED_VOWELS = str.maketrans("áéíóúÁÉÍÓÚüÜ", "aeiouAEIOUuU")


def _slugify_position_key(label: str) -> str:
    """Deriva una clave estable (minúsculas, snake_case, sin tildes) a partir
    del cargo tal cual viene escrito en el CSV, para que filas con el mismo
    cargo -aunque varíen en mayúsculas, espacios o tildes ("Ingeniería" vs.
    "ingenieria")- apunten a un único registro. El *label* que se muestra en
    la UI no pasa por esta función: se guarda tal cual lo escribió quien
    cargó el cargo por primera vez, tildes incluidas."""
    normalized = label.strip().lower().translate(_ACCENTED_VOWELS)
    normalized = re.sub(r"\s+", "_", normalized)
    normalized = re.sub(r"[^a-zñ0-9_]", "", normalized)
    normalized = normalized.strip("_") or "sin_cargo"
    return normalized[:64]


def _token_response(user) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id, user.role.value),
        refresh_token=create_refresh_token(user.id),
        user=UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            last_name=user.last_name,
            role=user.role,
            position=user.position,
            is_active=user.is_active,
            document_type=user.document_type,
            document_number=user.document_number,
        ),
    )


class CreateUserUseCase:
    def __init__(
        self,
        user_repo: UserRepository,
        position_repo: PositionRepository,
        event_bus: EventBus | None = None,
    ):
        self.user_repo = user_repo
        self.position_repo = position_repo
        self.user_service = UserService(user_repo)
        self.event_bus = event_bus

    async def execute(self, data: CreateUserRequest) -> UserResponse:
        if not await self.user_repo.is_email_available(data.email):
            raise ConflictError("El correo ya se encuentra registrado")

        if data.document_number and not await self.user_repo.is_document_available(
            data.document_number
        ):
            raise ConflictError("El documento ya está registrado para otra persona")

        if not await self.position_repo.key_exists(data.position):
            raise NotFoundError(f"El cargo '{data.position}' no existe")

        result = await self.user_service.create_user(data)

        if self.event_bus is not None:
            await self.event_bus.publish(
                UserCreated(
                    occurred_at=datetime.now(timezone.utc),
                    user_id=result.id,
                    email=result.email,
                    name=result.name,
                )
            )

        return result


class LoginUseCase:
    def __init__(self, user_repo: UserRepository):
        self._repo = user_repo

    async def execute(self, email: str, password: str) -> TokenResponse:
        user = await self._repo.get_by_email(email)

        if not user or not verify_password(password, user.password):
            raise UnauthorizedError("Credenciales incorrectas")

        if not user.is_active:
            raise UnauthorizedError("Usuario inactivo")

        return _token_response(user)


class RefreshTokenUseCase:
    def __init__(self, user_repo: UserRepository):
        self._repo = user_repo

    async def execute(self, refresh_token: str) -> TokenResponse:
        try:
            payload = decode_token(refresh_token)
        except JWTError:
            raise UnauthorizedError("Token de refresco inválido o expirado")

        if payload.get("type") != "refresh":
            raise UnauthorizedError("Token de refresco inválido")

        user = await self._repo.get_by_id(UUID(payload["sub"]))
        if not user or not user.is_active:
            raise UnauthorizedError("Usuario no encontrado o inactivo")

        return _token_response(user)


class GetUserByIdUseCase:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo
        self.user_service = UserService(user_repo)

    async def execute(self, user_id: UUID) -> UserResponse:
        return await self.user_service.get_by_id(user_id)


class SearchUsersUseCase:
    """Búsqueda paginada de usuarios para los selectores.

    Toma los filtros + la paginación (ya validada) y arma la respuesta paginada.
    La ruta solo delega; el offset/limit los aporta el value object Pagination.
    """

    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    async def execute(
        self,
        search: str | None,
        position: str | None,
        pagination: Pagination,
    ) -> PaginatedDirectoryResponse:
        items, total = await self.user_repo.search_directory(
            search=search,
            position=position,
            limit=pagination.limit,
            offset=pagination.offset,
        )
        return PaginatedDirectoryResponse(
            items=[DirectoryUserResponse.model_validate(u) for u in items],
            total=total,
            page=pagination.page,
            page_size=pagination.page_size,
        )


class SearchUsersAdminUseCase:
    """Búsqueda paginada para la gestión de usuarios (incluye inactivos)."""

    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    async def execute(
        self, search: str | None, pagination: Pagination
    ) -> PaginatedUsersResponse:
        items, total = await self.user_repo.search_users_admin(
            search=search, limit=pagination.limit, offset=pagination.offset
        )
        return PaginatedUsersResponse(
            items=[UserResponse.model_validate(u) for u in items],
            total=total,
            page=pagination.page,
            page_size=pagination.page_size,
        )


class UpdateUserUseCase:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo
        self.user_service = UserService(user_repo)

    async def execute(
        self,
        user_id: UUID,
        data: UpdateUserRequest,
    ) -> UserResponse:
        updated_user = await self.user_service.update(user_id, data)

        return updated_user

    async def patch(
        self,
        user_id: UUID,
        data: UpdateUserRequest,
    ) -> UserResponse:
        return await self.user_service.update(user_id, data)


class DeleteUserUseCase:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo
        self.user_service = UserService(user_repo)

    async def execute(self, user_id: UUID, actor_role: str) -> None:
        await self.user_service.delete(user_id=user_id, actor_role=actor_role)


class ChangeMyPasswordUseCase:
    """El propio usuario cambia su contraseña (verifica la actual)."""

    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    async def execute(self, user_id: UUID, current: str, new: str) -> None:
        user = await self.user_repo.get_by_id(user_id)
        if user is None:
            raise NotFoundError("Usuario no encontrado")
        if not verify_password(current, user.password):
            raise UnauthorizedError("La contraseña actual no es correcta")
        user.password = hash_password(new)
        await self.user_repo.save(user)


class ResetUserPasswordUseCase:
    """Un admin genera una contraseña temporal para un usuario y la devuelve."""

    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    async def execute(self, user_id: UUID) -> ResetPasswordResponse:
        user = await self.user_repo.get_by_id(user_id)
        if user is None:
            raise NotFoundError("Usuario no encontrado")
        temp = _generate_temp_password()
        user.password = hash_password(temp)
        await self.user_repo.save(user)
        return ResetPasswordResponse(user_id=user_id, temporary_password=temp)


class ListPositionsUseCase:
    """Cargos activos disponibles para asignar a un usuario."""

    def __init__(self, position_repo: PositionRepository):
        self.position_repo = position_repo

    async def execute(self) -> list[PositionOption]:
        positions = await self.position_repo.list_active()
        return [PositionOption(value=p.key, label=p.label) for p in positions]


class CreatePositionUseCase:
    """Alta de un cargo nuevo (admin/super_admin/developer): queda persistido
    de inmediato, sin migración, para que el próximo usuario ya pueda usarlo."""

    def __init__(self, position_repo: PositionRepository):
        self.position_repo = position_repo

    async def execute(self, data: CreatePositionRequest) -> PositionOption:
        # Normalizamos igual que la carga masiva: la clave que se compara y
        # persiste nunca lleva tildes, aunque la app hoy no deje escribirlas
        # desde el formulario (defensa ante llamadas directas a la API).
        key = _slugify_position_key(data.key)
        if await self.position_repo.key_exists(key):
            raise ConflictError(f"Ya existe un cargo con la clave '{key}'")

        position = await self.position_repo.add(Position(key=key, label=data.label))
        return PositionOption(value=position.key, label=position.label)


class BulkCreateUsersUseCase:
    """Alta masiva desde un CSV: el primer uso de la plataforma puede traer
    decenas de personas de una vez.

    Todo usuario cargado por este canal nace con rol `user` (el CSV no trae
    columna de rol: los roles de administración se asignan a mano después).
    Si el cargo de una fila no existe todavía en el catálogo, se crea sobre
    la marcha en vez de rechazar la fila.

    Procesamos cada fila de forma independiente (best effort): una fila mala
    (correo repetido, documento repetido) queda reportada en `failed` con el
    motivo, pero no bloquea la creación del resto del archivo.
    """

    REQUIRED_COLUMNS = ("email", "nombre", "apellido")

    def __init__(
        self,
        user_repo: UserRepository,
        position_repo: PositionRepository,
        event_bus: EventBus | None = None,
    ):
        self.user_repo = user_repo
        self.position_repo = position_repo
        self.user_service = UserService(user_repo)
        self.event_bus = event_bus

    async def _resolve_position_key(self, cargo_raw: str) -> str:
        """Devuelve la clave de un cargo existente, creándolo si hace falta."""
        cargo_label = cargo_raw.strip() or "Sin cargo"
        key = _slugify_position_key(cargo_label)
        if not await self.position_repo.key_exists(key):
            await self.position_repo.add(Position(key=key, label=cargo_label))
        return key

    async def execute(
        self, rows: list[dict[str, str]], actor_role: str
    ) -> BulkCreateUsersResponse:
        created: list[BulkCreatedUser] = []
        failed: list[BulkUserRowError] = []

        for index, row in enumerate(rows, start=1):
            # Normalizamos igual que CreateUserRequest: el correo identifica a la
            # persona, así que dos filas que difieran solo en mayúsculas o
            # espacios deben chocar como el mismo usuario.
            email = (row.get("email") or "").strip().lower()
            try:
                for column in self.REQUIRED_COLUMNS:
                    if not (row.get(column) or "").strip():
                        raise ValueError(f"Falta la columna '{column}'")

                if not await self.user_repo.is_email_available(email):
                    raise ValueError("El correo ya se encuentra registrado")

                cedula = (row.get("cedula") or "").strip() or None
                if cedula and not await self.user_repo.is_document_available(cedula):
                    raise ValueError("El documento ya está registrado")
                document_type = DocumentType.CEDULA_CIUDADANIA if cedula else None

                position_key = await self._resolve_position_key(
                    row.get("cargo") or "sin_cargo"
                )

                raw_password = (row.get("password") or "").strip()
                generated_password = not raw_password
                password = raw_password or _generate_temp_password()

                data = CreateUserRequest(
                    email=email,
                    password=password,
                    name=row["nombre"].strip(),
                    last_name=row["apellido"].strip(),
                    role=SystemRole.USER,
                    position=position_key,
                    document_type=document_type,
                    document_number=cedula,
                )
                user = await self.user_service.create_user(data)

                if self.event_bus is not None:
                    await self.event_bus.publish(
                        UserCreated(
                            occurred_at=datetime.now(timezone.utc),
                            user_id=user.id,
                            email=user.email,
                            name=user.name,
                        )
                    )

                created.append(
                    BulkCreatedUser(
                        id=user.id,
                        email=user.email,
                        name=user.name,
                        last_name=user.last_name,
                        temporary_password=(password if generated_password else None),
                    )
                )
            except ValidationError as exc:
                failed.append(
                    BulkUserRowError(
                        row=index,
                        email=email or None,
                        error="; ".join(e["msg"] for e in exc.errors()),
                    )
                )
            except ValueError as exc:
                failed.append(
                    BulkUserRowError(row=index, email=email or None, error=str(exc))
                )
            except Exception:
                # Red de seguridad: una fila con un fallo inesperado (p. ej. un
                # problema puntual de infraestructura al guardar) no debe tumbar
                # el resto del archivo. Queda registrada para diagnóstico.
                # El rollback es imprescindible: tras un flush fallido, la sesión
                # queda "aborted" y bloquearía también a las filas siguientes.
                await self.user_repo.rollback()
                logger.exception(
                    "Fila %s de carga masiva de usuarios falló de forma inesperada",
                    index,
                )
                failed.append(
                    BulkUserRowError(
                        row=index,
                        email=email or None,
                        error="No se pudo procesar esta fila por un error inesperado",
                    )
                )

        return BulkCreateUsersResponse(
            created=created, failed=failed, total_rows=len(rows)
        )
