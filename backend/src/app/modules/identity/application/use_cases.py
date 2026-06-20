from uuid import UUID

from jose import JWTError

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.modules.identity.domain.services import UserService
from app.modules.identity.infrastructure.enums import UserPosition
from app.modules.identity.presentation.schemas import (
    CreateUserRequest,
    DirectoryUserResponse,
    PaginatedDirectoryResponse,
    TokenResponse,
    UpdateUserRequest,
    UserResponse,
)
from app.modules.identity.infrastructure.repository import UserRepository
from app.shared.exceptions import ConflictError, UnauthorizedError
from app.shared.pagination import Pagination


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
        ),
    )


class CreateUserUseCase:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo
        self.user_service = UserService(user_repo)

    async def execute(self, data: CreateUserRequest) -> UserResponse:
        if not await self.user_repo.is_email_available(data.email):
            raise ConflictError("El correo ya se encuentra registrado")

        result = await self.user_service.create_user(data)

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
        position: UserPosition | None,
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

    async def execute(self, user_id: UUID) -> None:
        await self.user_service.delete(user_id=user_id)
