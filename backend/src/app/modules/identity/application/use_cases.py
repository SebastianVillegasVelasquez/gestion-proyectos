from app.core.security import create_access_token, create_refresh_token, verify_password
from app.modules.identity.domain.services import UserService
from app.modules.identity.presentation.schemas import (
    CreateUserRequest,
    TokenResponse,
    UserResponse,
)
from app.shared.base_repository import UserRepository
from app.shared.exceptions import ConflictError, UnauthorizedError


class CreateUserUseCase:
    def __init__(self, user_repo: UserRepository):
        self.user_repo = user_repo
        self.user_service = UserService(user_repo)

    async def execute(self, data: CreateUserRequest) -> UserResponse:
        is_available = await self.user_repo.is_email_available(data.email)
        if not is_available:
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
