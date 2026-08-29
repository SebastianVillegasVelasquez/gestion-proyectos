from uuid import UUID

from app.modules.identity.infrastructure.models import User
from app.modules.identity.presentation.schemas import (
    CreateUserRequest,
    UpdateUserRequest,
    UserResponse,
)
from app.modules.identity.infrastructure.repository import UserRepository
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
        if not await self._repo.is_email_available(data.email, exclude_id=user_id):
            raise ConflictError("El correo ya se encuentra registrado")

        existing_user = await self._repo.get_by_id(user_id)

        if not existing_user:
            raise NotFoundError("Usuario no encontrado")

        update_data = data.model_dump(exclude_unset=True)

        if "password" in update_data:
            update_data["password"] = self.hash_password(update_data.pop("password"))

        # `document_type` es un enum; la columna guarda el texto plano.
        if update_data.get("document_type") is not None:
            update_data["document_type"] = update_data["document_type"].value

        for field, value in update_data.items():
            setattr(existing_user, field, value)

        updated_user = await self._repo.update(existing_user)
        return self._to_response(updated_user)

    def convert_to_orm(self, data: CreateUserRequest) -> User:
        if data.password is None:
            # El use case (CreateUserUseCase / carga masiva) siempre define una
            # contraseña antes de llegar aquí —propia o generada—; esto solo
            # protege de un uso indebido del servicio.
            raise ValueError("Falta la contraseña para crear el usuario")
        return User(
            email=data.email,
            password=self.hash_password(data.password),
            name=data.name,
            last_name=data.last_name,
            role=data.role,
            position=data.position,
            document_type=data.document_type.value if data.document_type else None,
            document_number=data.document_number,
            # Alta hecha por un admin: la persona recibe una clave que no eligió
            # (y el correo de bienvenida), así que debe cambiarla al entrar.
            must_change_password=True,
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
            position=user.position,
            is_active=user.is_active,
            document_type=user.document_type,
            document_number=user.document_number,
            created_at=user.created_at,
            must_change_password=getattr(user, "must_change_password", False),
        )
