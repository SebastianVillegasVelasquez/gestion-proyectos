from __future__ import annotations

import datetime
from abc import ABC, abstractmethod
from uuid import UUID

from app.modules.reminders.infrastructure.enums import ReminderStatus
from app.modules.reminders.infrastructure.models import PersonalReminder


class ReminderRepository(ABC):
    @abstractmethod
    async def add(self, reminder: PersonalReminder) -> PersonalReminder: ...

    @abstractmethod
    async def get(self, reminder_id: UUID) -> PersonalReminder | None: ...

    @abstractmethod
    async def list_for_user(
        self, user_id: UUID, status: ReminderStatus | None
    ) -> list[PersonalReminder]: ...

    @abstractmethod
    async def save(self, reminder: PersonalReminder) -> PersonalReminder: ...

    @abstractmethod
    async def delete(self, reminder: PersonalReminder) -> None: ...

    @abstractmethod
    async def list_due(
        self, now: datetime.datetime, limit: int
    ) -> list[PersonalReminder]:
        """Recordatorios PENDIENTE cuyo `remind_at` ya pasó (para el worker)."""
