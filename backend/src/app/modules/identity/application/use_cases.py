from app.modules.identity.domain.services import UserService
from app.modules.identity.presentation.schemas import CreateUserRequest, UserResponse
from app.shared.base_repository import UserRepository
from app.shared.exceptions import ConflictError


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
