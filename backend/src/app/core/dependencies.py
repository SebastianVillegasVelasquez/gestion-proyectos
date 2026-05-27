from uuid import UUID

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.modules.identity.presentation.schemas import UserResponse
from app.shared.base_repository import UserRepository
from app.shared.exceptions import ForbiddenError, NotFoundError


def repo_dependency(db: AsyncSession = Depends(get_db)):
    return UserRepository(db)


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    try:
        payload = decode_token(token)
    except JWTError:
        raise ForbiddenError("Token inválido o expirado")

    if payload.get("type") != "access":
        raise ForbiddenError("Token inválido")

    user_id = UUID(payload["sub"])

    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)

    if not user or not user.is_active:
        raise NotFoundError("Usuario no encontrado")

    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        last_name=user.last_name,
        role=user.role,
        is_active=user.is_active,
    )


def require_role(*roles: str):
    async def _check(current_user=Depends(get_current_user)):
        if current_user.role not in roles:
            raise ForbiddenError("No tienes permiso")
        return current_user

    return _check
