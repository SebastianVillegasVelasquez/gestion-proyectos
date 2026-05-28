from uuid import UUID

from app.modules.identity.infrastructure.models import User
from app.modules.identity.presentation.schemas import (
    CreateUserRequest,
    UpdateUserRequest,
    UserResponse,
)
from app.shared.base_repository import UserRepository
from app.shared.exceptions import NotFoundError, ConflictError


class UserService:
    def __init__(self, repo: UserRepository):
        self._repo = repo

    async def create_user(self, data: CreateUserRequest) -> UserResponse:
        orm = self.convert_to_orm(data)
        created_user = await self._repo.add(orm)

        return self._to_response(created_user)

    async def get_by_id(self, user_id: UUID) -> UserResponse:
        user = await self._repo.get_by_id(user_id)

        if not user:
            raise NotFoundError("Usuario no encontrado")

        return self._to_response(user)

    async def get_all_users(self) -> list[UserResponse]:
        users = await self._repo.get_all()

        return [self._to_response(user) for user in users]

    async def update(
        self,
        user_id: UUID,
        data: UpdateUserRequest,
    ) -> UserResponse:
        if not await self._repo.is_email_available(data.model_dump()["email"]):
            raise ConflictError("El correo ya se encuentra registrado")

        existing_user = await self._repo.get_by_id(user_id)

        if not existing_user:
            raise NotFoundError("Usuario no encontrado")

        update_data = data.model_dump(exclude_unset=True)

        if "password" in update_data:
            update_data["hashed_password"] = self.hash_password(
                update_data.pop("password")
            )

        for field, value in update_data.items():
            setattr(existing_user, field, value)

        updated_user = await self._repo.update(existing_user)
        print(updated_user)
        return self._to_response(updated_user)

    async def delete(self, user_id: UUID) -> None:
        existing_user = await self._repo.get_by_id(user_id)

        if not existing_user:
            raise NotFoundError("Usuario no encontrado")

        await self._repo.soft_delete(existing_user)

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

    @staticmethod
    def _to_response(user: User) -> UserResponse:
        return UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            last_name=user.last_name,
            role=user.role,
            is_active=user.is_active,
        )
