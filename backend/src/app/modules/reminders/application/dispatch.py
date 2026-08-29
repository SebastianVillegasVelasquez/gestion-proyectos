"""Despacho de recordatorios personales vencidos.

Un worker en segundo plano (ver ``app.core.overdue_worker``) llama a
``dispatch_due_reminders`` cada pocos minutos. Por cada recordatorio
``PENDIENTE`` cuya hora ya pasó:

  * crea una notificación ``RECORDATORIO`` (si el canal la incluye),
  * envía un correo con la marca OBJ (si el canal lo incluye),
  * marca el recordatorio ``ENVIADO`` con ``sent_at``.

Idempotente por diseño: solo toca filas ``PENDIENTE`` y las pasa a
``ENVIADO`` en el mismo commit, así una segunda pasada no reenvía nada.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import get_logger
from app.modules.notifications.infrastructure.enums import NotificationType
from app.modules.notifications.infrastructure.models import Notification
from app.modules.reminders.infrastructure.enums import (
    ReminderChannel,
    ReminderStatus,
)
from app.modules.reminders.infrastructure.repository import (
    SqlAlchemyReminderRepository,
)
from app.shared.broadcasting.broadcaster import Broadcaster
from app.shared.email.sender import EmailSender
from app.shared.email.templates import reminder_email

logger = get_logger(__name__)

_BATCH = 200
_WANTS_NOTIFICATION = {ReminderChannel.NOTIFICACION, ReminderChannel.AMBOS}
_WANTS_EMAIL = {ReminderChannel.CORREO, ReminderChannel.AMBOS}


@dataclass(frozen=True)
class ReminderDispatchResult:
    due: int
    notifications: int
    emails: int


async def dispatch_due_reminders(
    session: AsyncSession,
    *,
    email_sender: EmailSender,
    broadcaster: Broadcaster | None = None,
) -> ReminderDispatchResult:
    repo = SqlAlchemyReminderRepository(session)
    now = datetime.now(timezone.utc)
    due = await repo.list_due(now, _BATCH)

    notifications = emails = 0
    for reminder in due:
        if reminder.channel in _WANTS_NOTIFICATION:
            session.add(
                Notification(
                    user_to_id=reminder.user_id,
                    notification_type=NotificationType.RECORDATORIO,
                    message=f"Recordatorio: {reminder.title}",
                    payload={"reminder_id": str(reminder.id)},
                )
            )
            notifications += 1
            if broadcaster is not None:
                try:
                    await broadcaster.publish(
                        channel=f"notifications:user:{reminder.user_id}",
                        message=json.dumps({"type": "notification.new"}),
                    )
                except Exception:
                    logger.exception(
                        "No se pudo publicar el recordatorio %s", reminder.id
                    )

        user = getattr(reminder, "user", None)
        if reminder.channel in _WANTS_EMAIL and user is not None and user.email:
            mail = reminder_email(
                name=user.name, title=reminder.title, note=reminder.note
            )
            try:
                await email_sender.send(
                    to=user.email,
                    subject=mail.subject,
                    body=mail.text,
                    html=mail.html,
                )
                emails += 1
            except Exception:
                logger.error(
                    "Fallo al enviar correo de recordatorio",
                    reminder_id=str(reminder.id),
                    exc_info=True,
                )

        reminder.status = ReminderStatus.ENVIADO
        reminder.sent_at = now

    await session.flush()
    result = ReminderDispatchResult(
        due=len(due), notifications=notifications, emails=emails
    )
    if result.due:
        logger.info(
            "Recordatorios despachados",
            due=result.due,
            notifications=result.notifications,
            emails=result.emails,
        )
    return result
