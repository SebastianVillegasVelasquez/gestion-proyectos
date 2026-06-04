from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.infrastructure.models import User
from app.shared.base_repository import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(model=User, session=session)

    async def get_by_email(self, email: str) -> User | None:
        query = select(User).where(User.email == email)

        result = await self._session.execute(query)

        return result.scalars().first()

    async def is_email_available(self, email: str) -> bool:
        user = await self.get_by_email(email)

        return user is None

    async def soft_delete(self, user: User) -> User:
        user.is_active = False

        return await self.save(user)
