from uuid import UUID

from app.core.security import create_access_token, create_refresh_token, verify_password
from app.modules.identity.domain.services import UserService
from app.modules.identity.presentation.schemas import (
    CreateUserRequest,
    TokenResponse,
    UpdateUserRequest,
    UserResponse,
)
from app.shared.base_repository import UserRepository
from app.shared.exceptions import ConflictError, UnauthorizedError


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

        if not user or not verify_password(password, user.hashed_password):
            raise UnauthorizedError("Credenciales incorrectas")

        if not user.is_active:
            raise UnauthorizedError("Usuario inactivo")

        return TokenResponse(
            access_token=create_access_token(user.id, user.role.value),
            refresh_token=create_refresh_token(user.id),
            user=UserResponse(
                id=user.id,
                email=user.email,
                name=user.name,
                last_name=user.last_name,
                role=user.role,
                is_active=user.is_active,
            ),
        )


class GetUserByIdUseCase:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo
        self.user_service = UserService(user_repo)

    async def execute(self, user_id: UUID) -> UserResponse:
        return await self.user_service.get_by_id(user_id)


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
