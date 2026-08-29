from __future__ import annotations

import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.reminders.domain.repository import ReminderRepository
from app.modules.reminders.infrastructure.enums import ReminderStatus
from app.modules.reminders.infrastructure.models import PersonalReminder


class SqlAlchemyReminderRepository(ReminderRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, reminder: PersonalReminder) -> PersonalReminder:
        self._session.add(reminder)
        await self._session.flush()
        await self._session.refresh(reminder)
        return reminder

    async def get(self, reminder_id: UUID) -> PersonalReminder | None:
        return await self._session.get(PersonalReminder, reminder_id)

    async def list_for_user(
        self, user_id: UUID, status: ReminderStatus | None
    ) -> list[PersonalReminder]:
        conditions = [PersonalReminder.user_id == user_id]
        if status is not None:
            conditions.append(PersonalReminder.status == status)
        rows = await self._session.execute(
            select(PersonalReminder)
            .where(*conditions)
            .order_by(PersonalReminder.remind_at.asc())
        )
        return list(rows.scalars().all())

    async def save(self, reminder: PersonalReminder) -> PersonalReminder:
        await self._session.flush()
        await self._session.refresh(reminder)
        return reminder

    async def delete(self, reminder: PersonalReminder) -> None:
        await self._session.delete(reminder)
        await self._session.flush()

    async def list_due(
        self, now: datetime.datetime, limit: int
    ) -> list[PersonalReminder]:
        rows = await self._session.execute(
            select(PersonalReminder)
            .where(
                PersonalReminder.status == ReminderStatus.PENDIENTE,
                PersonalReminder.remind_at <= now,
            )
            .options(selectinload(PersonalReminder.user))
            .order_by(PersonalReminder.remind_at.asc())
            .limit(limit)
        )
        return list(rows.scalars().all())
