from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.infrastructure.enums import UserPosition
from app.modules.identity.infrastructure.models import User
from app.shared.base_repository import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(model=User, session=session)

    async def get_by_email(self, email: str) -> User | None:
        query = select(User).where(User.email == email)

        result = await self._session.execute(query)

        return result.scalars().first()

    async def search_directory(
        self,
        search: str | None,
        position: UserPosition | None,
        limit: int,
        offset: int,
    ) -> tuple[list[User], int]:
        """Búsqueda paginada de usuarios activos por nombre/apellido/correo y cargo.

        Devuelve (página de usuarios, total que cumple el filtro) para no traer
        toda la tabla al cliente.
        """
        conditions: list[ColumnElement[bool]] = [
            User.is_active.is_(True),
            User.deleted_at.is_(None),
        ]
        if position is not None:
            conditions.append(User.position == position)
        if search:
            like = f"%{search.strip()}%"
            conditions.append(
                or_(
                    User.name.ilike(like),
                    User.last_name.ilike(like),
                    User.email.ilike(like),
                )
            )

        total = await self._session.scalar(
            select(func.count()).select_from(User).where(*conditions)
        )
        rows = (
            (
                await self._session.execute(
                    select(User)
                    .where(*conditions)
                    .order_by(User.name, User.last_name)
                    .limit(limit)
                    .offset(offset)
                )
            )
            .scalars()
            .all()
        )
        return list(rows), int(total or 0)

    async def is_email_available(self, email: str) -> bool:
        user = await self.get_by_email(email)

        return user is None

    async def soft_delete(self, user: User) -> User:
        user.is_active = False

        return await self.save(user)
