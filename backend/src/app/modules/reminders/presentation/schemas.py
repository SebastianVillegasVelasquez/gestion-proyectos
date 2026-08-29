from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Optional
from uuid import UUID

from pydantic import StringConstraints, field_validator

from app.modules.reminders.infrastructure.enums import (
    ReminderChannel,
    ReminderStatus,
)
from app.shared.base_model import BaseModelConfig

_Title = Annotated[
    str, StringConstraints(min_length=2, max_length=200, strip_whitespace=True)
]
_Note = Annotated[str, StringConstraints(max_length=2000)]


def _must_be_future(value: datetime) -> datetime:
    # Normaliza a aware (asume UTC si viene naive) y exige que sea futuro:
    # un recordatorio en el pasado no tiene a quién avisar "a tiempo".
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    if value <= datetime.now(timezone.utc):
        raise ValueError("La fecha del recordatorio debe ser futura")
    return value


class CreateReminderRequest(BaseModelConfig):
    title: _Title
    note: Optional[_Note] = None
    remind_at: datetime
    channel: ReminderChannel = ReminderChannel.NOTIFICACION

    _check_future = field_validator("remind_at")(_must_be_future)


class UpdateReminderRequest(BaseModelConfig):
    title: Optional[_Title] = None
    note: Optional[_Note] = None
    remind_at: Optional[datetime] = None
    channel: Optional[ReminderChannel] = None

    @field_validator("remind_at")
    @classmethod
    def _future(cls, value: Optional[datetime]) -> Optional[datetime]:
        return _must_be_future(value) if value is not None else None


class ReminderResponse(BaseModelConfig):
    id: UUID
    title: str
    note: Optional[str] = None
    remind_at: datetime
    channel: ReminderChannel
    status: ReminderStatus
    sent_at: Optional[datetime] = None
    created_at: datetime
