from __future__ import annotations

from uuid import UUID

from app.modules.reminders.domain.repository import ReminderRepository
from app.modules.reminders.infrastructure.enums import ReminderStatus
from app.modules.reminders.infrastructure.models import PersonalReminder
from app.modules.reminders.presentation.schemas import (
    CreateReminderRequest,
    ReminderResponse,
    UpdateReminderRequest,
)
from app.shared.exceptions import NotFoundError, ValidationError


class ReminderService:
    """Recordatorios personales: cada quien gestiona SOLO los suyos."""

    def __init__(self, repo: ReminderRepository) -> None:
        self._repo = repo

    async def _own(self, reminder_id: UUID, user_id: UUID) -> PersonalReminder:
        reminder = await self._repo.get(reminder_id)
        if reminder is None or reminder.user_id != user_id:
            raise NotFoundError("El recordatorio no existe")
        return reminder

    async def create(
        self, user_id: UUID, data: CreateReminderRequest
    ) -> ReminderResponse:
        reminder = await self._repo.add(
            PersonalReminder(
                user_id=user_id,
                title=data.title,
                note=data.note,
                remind_at=data.remind_at,
                channel=data.channel,
                status=ReminderStatus.PENDIENTE,
            )
        )
        return ReminderResponse.model_validate(reminder)

    async def list_mine(
        self, user_id: UUID, status: ReminderStatus | None
    ) -> list[ReminderResponse]:
        rows = await self._repo.list_for_user(user_id, status)
        return [ReminderResponse.model_validate(r) for r in rows]

    async def update(
        self, reminder_id: UUID, user_id: UUID, data: UpdateReminderRequest
    ) -> ReminderResponse:
        reminder = await self._own(reminder_id, user_id)
        if reminder.status != ReminderStatus.PENDIENTE:
            raise ValidationError("Solo se puede editar un recordatorio pendiente")
        if data.title is not None:
            reminder.title = data.title
        if data.note is not None:
            reminder.note = data.note
        if data.remind_at is not None:
            reminder.remind_at = data.remind_at
        if data.channel is not None:
            reminder.channel = data.channel
        saved = await self._repo.save(reminder)
        return ReminderResponse.model_validate(saved)

    async def cancel(self, reminder_id: UUID, user_id: UUID) -> ReminderResponse:
        reminder = await self._own(reminder_id, user_id)
        if reminder.status == ReminderStatus.ENVIADO:
            raise ValidationError("Ese recordatorio ya se envió")
        reminder.status = ReminderStatus.CANCELADO
        saved = await self._repo.save(reminder)
        return ReminderResponse.model_validate(saved)

    async def delete(self, reminder_id: UUID, user_id: UUID) -> None:
        reminder = await self._own(reminder_id, user_id)
        await self._repo.delete(reminder)
