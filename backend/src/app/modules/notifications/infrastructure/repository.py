from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notifications.domain.repository import NotificationRepository
from app.modules.notifications.infrastructure.models import Notification


class SqlAlchemyNotificationRepository(NotificationRepository):
    """Implementación concreta con SQLAlchemy."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, notification: Notification) -> Notification:
        self._session.add(notification)
        await self._session.flush()
        await self._session.refresh(notification)
        return notification

    async def get(self, notification_id: UUID) -> Notification | None:
        return await self._session.get(Notification, notification_id)

    async def list_for_user(
        self,
        user_id: UUID,
        only_unread: bool,
        limit: int,
        offset: int,
    ) -> tuple[list[Notification], int]:
        conditions = [Notification.user_to_id == user_id]
        if only_unread:
            conditions.append(Notification.read_at.is_(None))

        total = await self._session.scalar(
            select(func.count()).select_from(Notification).where(*conditions)
        )

        rows = (
            (
                await self._session.execute(
                    select(Notification)
                    .where(*conditions)
                    .order_by(Notification.created_at.desc())
                    .limit(limit)
                    .offset(offset)
                )
            )
            .scalars()
            .all()
        )
        return list(rows), int(total or 0)

    async def count_unread(self, user_id: UUID) -> int:
        total = await self._session.scalar(
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.user_to_id == user_id,
                Notification.read_at.is_(None),
            )
        )
        return int(total or 0)

    async def mark_as_read(self, notification: Notification) -> Notification:
        if notification.read_at is None:
            notification.read_at = datetime.now(timezone.utc)
            await self._session.flush()
            await self._session.refresh(notification)
        return notification

    async def mark_all_as_read(self, user_id: UUID) -> int:
        # UPDATE masivo: más eficiente que cargar y mutar fila a fila.
        result = await self._session.execute(
            update(Notification)
            .where(
                Notification.user_to_id == user_id,
                Notification.read_at.is_(None),
            )
            .values(read_at=datetime.now(timezone.utc))
        )
        await self._session.flush()
        return int(result.rowcount or 0)

    async def delete(self, notification: Notification) -> None:
        await self._session.delete(notification)
        await self._session.flush()
