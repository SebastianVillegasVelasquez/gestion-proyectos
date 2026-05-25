from app.modules.identity.infrastructure.models import User
from app.modules.identity.presentation.schemas import CreateUserRequest, UserResponse
from app.shared.base_repository import UserRepository


class UserService:
    def __init__(self, repo: UserRepository):
        self._repo = repo

    async def create_user(self, data: CreateUserRequest) -> UserResponse:
        orm = self.convert_to_orm(data)
        created_user = await self._repo.add(orm)
        return UserResponse(
            id=created_user.id,
            email=created_user.email,
            name=created_user.name,
            last_name=created_user.last_name,
            role=created_user.role,
            is_active=created_user.is_active,
        )

    def convert_to_orm(self, data: CreateUserRequest) -> User:
        return User(
            email=data.email,
            hashed_password=self.hash_password(data.password),
            name=data.name,
            last_name=data.last_name,
            role=data.role,
        )

    @staticmethod
    def hash_password(password: str) -> str:
        from pwdlib import PasswordHash

        password_hash = PasswordHash.recommended()

        return password_hash.hash(password)
