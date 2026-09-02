from datetime import datetime, timedelta, timezone
from uuid import UUID

from jose import JWTError

import hashlib
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
    ActivationInfoResponse,
    ActivationLinkResponse,
    BulkCreatedUser,
    BulkCreateUsersResponse,
    BulkUserRowError,
    CreatedUserResponse,
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


def _hash_activation_token(raw: str) -> str:
    """SHA-256 hex del token. Se guarda el hash, nunca el token en claro: una
    fuga de la tabla `users` no entrega tokens usables."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _new_activation_token() -> tuple[str, str]:
    """(token en claro, su hash). El claro viaja por correo; el hash a la BD."""
    raw = secrets.token_urlsafe(32)
    return raw, _hash_activation_token(raw)


async def _issue_activation_token(
    user_repo: UserRepository, user_id: UUID, ttl_days: int
) -> str:
    """Genera y persiste un token de activación para `user_id`, devolviendo el
    token en claro (para el correo). Reemplaza cualquier token anterior."""
    raw, token_hash = _new_activation_token()
    user = await user_repo.get_by_id(user_id)
    if user is None:
        raise NotFoundError("Usuario no encontrado")
    user.activation_token_hash = token_hash
    user.activation_token_expires_at = datetime.now(timezone.utc) + timedelta(
        days=ttl_days
    )
    await user_repo.save(user)
    return raw


def _activation_url(public_url: str, raw_token: str) -> str | None:
    base = (public_url or "").rstrip("/")
    return f"{base}/activar?token={raw_token}" if base else None


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
            created_at=user.created_at,
            must_change_password=getattr(user, "must_change_password", False),
        ),
    )


class CreateUserUseCase:
    def __init__(
        self,
        user_repo: UserRepository,
        position_repo: PositionRepository,
        event_bus: EventBus | None = None,
        public_url: str = "",
        activation_ttl_days: int = 7,
    ):
        self.user_repo = user_repo
        self.position_repo = position_repo
        self.user_service = UserService(user_repo)
        self.event_bus = event_bus
        self._public_url = public_url
        self._ttl_days = activation_ttl_days

    async def execute(self, data: CreateUserRequest) -> CreatedUserResponse:
        if not await self.user_repo.is_email_available(data.email):
            raise ConflictError("El correo ya se encuentra registrado")

        if data.document_number and not await self.user_repo.is_document_available(
            data.document_number
        ):
            raise ConflictError("El documento ya está registrado para otra persona")

        if not await self.position_repo.key_exists(data.position):
            raise NotFoundError(f"El cargo '{data.position}' no existe")

        # Sin contraseña definida por el admin: la cuenta se crea SIN clave
        # utilizable (una aleatoria de relleno) y se emite un token de activación
        # de un solo uso. El correo lleva el enlace; nunca viaja una credencial.
        activate = not data.password
        if activate:
            data = data.model_copy(update={"password": _generate_temp_password()})

        result = await self.user_service.create_user(data)

        activation_token: str | None = None
        if activate:
            activation_token = await _issue_activation_token(
                self.user_repo, result.id, self._ttl_days
            )

        if self.event_bus is not None:
            await self.event_bus.publish(
                UserCreated(
                    occurred_at=datetime.now(timezone.utc),
                    user_id=result.id,
                    email=result.email,
                    name=result.name,
                    activation_token=activation_token,
                )
            )

        return CreatedUserResponse(
            **result.model_dump(),
            temporary_password=None,
            activation_url=(
                _activation_url(self._public_url, activation_token)
                if activation_token
                else None
            ),
        )


class ActivateAccountUseCase:
    """Activa una cuenta a partir de su token de un solo uso: valida el token,
    fija la contraseña que elige la persona, limpia el token y devuelve sesión
    iniciada (mismo TokenResponse que el login)."""

    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    async def execute(self, token: str, new_password: str) -> TokenResponse:
        user = await self.user_repo.get_by_activation_token_hash(
            _hash_activation_token(token)
        )
        expires = getattr(user, "activation_token_expires_at", None) if user else None
        if user is None or expires is None:
            raise UnauthorizedError("El enlace de activación no es válido")
        if expires < datetime.now(timezone.utc):
            raise UnauthorizedError(
                "El enlace de activación caducó. Pide uno nuevo a quien te dio de alta."
            )
        user.password = hash_password(new_password)
        user.must_change_password = False
        user.is_active = True
        user.activation_token_hash = None
        user.activation_token_expires_at = None
        await self.user_repo.save(user)
        return _token_response(user)


class GetActivationInfoUseCase:
    """Datos mínimos para la pantalla de activación (a quién pertenece el enlace)."""

    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo

    async def execute(self, token: str) -> ActivationInfoResponse:
        user = await self.user_repo.get_by_activation_token_hash(
            _hash_activation_token(token)
        )
        expires = getattr(user, "activation_token_expires_at", None) if user else None
        expired = expires is not None and expires < datetime.now(timezone.utc)
        if user is None or expires is None or expired:
            raise UnauthorizedError("El enlace de activación no es válido o caducó")
        return ActivationInfoResponse(email=user.email, name=user.name)


class ResendActivationUseCase:
    """Un admin regenera y reenvía el enlace de activación de una cuenta que aún
    no se ha activado (p. ej. el anterior caducó)."""

    def __init__(
        self,
        user_repo: UserRepository,
        event_bus: EventBus | None = None,
        public_url: str = "",
        activation_ttl_days: int = 7,
    ):
        self.user_repo = user_repo
        self.event_bus = event_bus
        self._public_url = public_url
        self._ttl_days = activation_ttl_days

    async def execute(self, user_id: UUID) -> ActivationLinkResponse:
        user = await self.user_repo.get_by_id(user_id)
        if user is None:
            raise NotFoundError("Usuario no encontrado")
        raw = await _issue_activation_token(self.user_repo, user_id, self._ttl_days)
        if self.event_bus is not None:
            await self.event_bus.publish(
                UserCreated(
                    occurred_at=datetime.now(timezone.utc),
                    user_id=user.id,
                    email=user.email,
                    name=user.name,
                    activation_token=raw,
                )
            )
        expires = datetime.now(timezone.utc) + timedelta(days=self._ttl_days)
        return ActivationLinkResponse(
            activation_url=_activation_url(self._public_url, raw),
            expires_at=expires,
        )


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
        self,
        search: str | None,
        pagination: Pagination,
        include_inactive: bool = True,
        sort_by: str = "name",
        sort_dir: str = "asc",
    ) -> PaginatedUsersResponse:
        items, total = await self.user_repo.search_users_admin(
            search=search,
            limit=pagination.limit,
            offset=pagination.offset,
            include_inactive=include_inactive,
            sort_by=sort_by,
            sort_dir=sort_dir,
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
        # Ya eligió una clave propia: se levanta la obligación del primer ingreso.
        user.must_change_password = False
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
        # Clave temporal: la persona deberá cambiarla en su próximo ingreso.
        user.must_change_password = True
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
        # Quien crea el cargo solo escribe el nombre ("Diseñador Gráfico"):
        # la clave estable la derivamos aquí, igual que en la carga masiva, así
        # que dos formas de escribir el mismo cargo ("Diseñador Gráfico" vs.
        # "diseñador grafico") no generan dos registros distintos.
        label = data.label.strip()
        key = _slugify_position_key(label)
        if await self.position_repo.key_exists(key):
            raise ConflictError(f"Ya existe el cargo '{label}'")

        position = await self.position_repo.add(Position(key=key, label=label))
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
        activation_ttl_days: int = 7,
    ):
        self.user_repo = user_repo
        self.position_repo = position_repo
        self.user_service = UserService(user_repo)
        self.event_bus = event_bus
        self._ttl_days = activation_ttl_days

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
                activate = not raw_password
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

                # Sin contraseña en el CSV → enlace de activación (no viaja clave).
                activation_token = (
                    await _issue_activation_token(
                        self.user_repo, user.id, self._ttl_days
                    )
                    if activate
                    else None
                )

                if self.event_bus is not None:
                    await self.event_bus.publish(
                        UserCreated(
                            occurred_at=datetime.now(timezone.utc),
                            user_id=user.id,
                            email=user.email,
                            name=user.name,
                            activation_token=activation_token,
                        )
                    )

                created.append(
                    BulkCreatedUser(
                        id=user.id,
                        email=user.email,
                        name=user.name,
                        last_name=user.last_name,
                        temporary_password=None,
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
