"""Barrido de tareas atrasadas.

Una tarea está *atrasada* si su ``due_date`` ya pasó y no está ``COMPLETADA``
ni ``CANCELADA``. Por cada una se avisa al responsable con:

  * una notificación ``TAREA_ATRASADA`` (campanita + tiempo real), y
  * un correo de advertencia con la marca OBJ.

**Anti-spam:** no se vuelve a avisar de la misma tarea si ya se generó una
notificación ``TAREA_ATRASADA`` para ella en las últimas ``COOLDOWN_HOURS``.
El propio historial de notificaciones es el registro de "ya avisé"; no hace
falta una columna nueva en ``tasks``.

Se ejecuta desde dos sitios (ver ``main.lifespan`` y las rutas de
notificaciones): un bucle en segundo plano y un endpoint para admins.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import and_, exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logger import get_logger
from app.modules.identity.infrastructure.models import User
from app.modules.notifications.infrastructure.enums import NotificationType
from app.modules.notifications.infrastructure.models import Notification
from app.modules.project.infrastructure.models import Project
from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.tasks.infrastructure.models import Task
from app.shared.email.sender import EmailSender
from app.shared.email.templates import due_soon_task_email, overdue_task_email

logger = get_logger(__name__)

COOLDOWN_HOURS = 20

# Con cuántos días de anticipación se avisa que una tarea está por vencer.
# Un solo aviso (no uno por cada día que quede) evita saturar la campanita.
DUE_SOON_DAYS = 1

_CLOSED = (TaskStatus.COMPLETADA, TaskStatus.CANCELADA)


@dataclass(frozen=True)
class OverdueScanResult:
    checked: int
    notified: int
    skipped_cooldown: int
    emails_sent: int


def _task_url(public_url: str, task: Task) -> str:
    base = public_url.rstrip("/")
    if not base:
        return ""
    return f"{base}/projects/{task.project_id}/tasks/{task.id}"


async def scan_overdue_tasks(
    session: AsyncSession,
    *,
    email_sender: EmailSender,
    public_url: str = "",
    today: date | None = None,
) -> OverdueScanResult:
    today = today or datetime.now(timezone.utc).date()
    cutoff = datetime.now(timezone.utc) - timedelta(hours=COOLDOWN_HOURS)

    # Tareas atrasadas con responsable, junto a datos del responsable y proyecto.
    rows = (
        await session.execute(
            select(Task, User, Project.name)
            .join(User, Task.assignee_id == User.id)
            .join(Project, Task.project_id == Project.id)
            .where(
                Task.deleted_at.is_(None),
                Task.due_date.is_not(None),
                Task.due_date < today,
                Task.status.not_in(_CLOSED),
                Task.assignee_id.is_not(None),
                User.is_active.is_(True),
            )
        )
    ).all()

    checked = len(rows)
    notified = skipped = emails = 0

    for task, assignee, project_name in rows:
        recent_exists = await session.scalar(
            select(
                exists().where(
                    and_(
                        Notification.notification_type
                        == NotificationType.TAREA_ATRASADA,
                        Notification.user_to_id == assignee.id,
                        Notification.payload["task_id"].astext == str(task.id),
                        Notification.created_at >= cutoff,
                    )
                )
            )
        )
        if recent_exists:
            skipped += 1
            continue

        days_overdue = (today - task.due_date).days
        task_url = _task_url(public_url, task)

        session.add(
            Notification(
                user_to_id=assignee.id,
                notification_type=NotificationType.TAREA_ATRASADA,
                message=(
                    f'La tarea "{task.title}" venció hace {days_overdue} '
                    f"{'día' if days_overdue == 1 else 'días'}."
                ),
                payload={
                    "task_id": str(task.id),
                    "project_id": str(task.project_id),
                    "work_item_id": (
                        str(task.work_item_id) if task.work_item_id else None
                    ),
                    "days_overdue": days_overdue,
                },
            )
        )
        notified += 1

        mail = overdue_task_email(
            name=assignee.name,
            task_title=task.title,
            project_name=project_name,
            due_date=task.due_date,
            days_overdue=days_overdue,
            task_url=task_url,
        )
        try:
            await email_sender.send(
                to=assignee.email,
                subject=mail.subject,
                body=mail.text,
                html=mail.html,
            )
            emails += 1
        except Exception:  # noqa: BLE001 - un correo caído no aborta el barrido
            logger.error(
                "Fallo al enviar correo de tarea atrasada",
                task_id=str(task.id),
                exc_info=True,
            )

    await session.flush()
    result = OverdueScanResult(
        checked=checked,
        notified=notified,
        skipped_cooldown=skipped,
        emails_sent=emails,
    )
    logger.info(
        "Barrido de tareas atrasadas",
        checked=result.checked,
        notified=result.notified,
        skipped_cooldown=result.skipped_cooldown,
        emails_sent=result.emails_sent,
    )
    return result


@dataclass(frozen=True)
class DueSoonScanResult:
    checked: int
    notified: int
    skipped_cooldown: int
    emails_sent: int


async def scan_due_soon_tasks(
    session: AsyncSession,
    *,
    email_sender: EmailSender,
    public_url: str = "",
    today: date | None = None,
) -> DueSoonScanResult:
    """Avisa de tareas que vencen en `DUE_SOON_DAYS` días o menos, para que el
    responsable reaccione ANTES de quedar atrasado (`TAREA_ATRASADA` ya cubre
    el después). Mismo anti-spam por cooldown que el barrido de atrasadas: una
    sola notificación de este tipo por tarea dentro de `COOLDOWN_HOURS`.
    """
    today = today or datetime.now(timezone.utc).date()
    limit = today + timedelta(days=DUE_SOON_DAYS)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=COOLDOWN_HOURS)

    rows = (
        await session.execute(
            select(Task, User, Project.name)
            .join(User, Task.assignee_id == User.id)
            .join(Project, Task.project_id == Project.id)
            .where(
                Task.deleted_at.is_(None),
                Task.due_date.is_not(None),
                Task.due_date >= today,
                Task.due_date <= limit,
                Task.status.not_in(_CLOSED),
                Task.assignee_id.is_not(None),
                User.is_active.is_(True),
            )
        )
    ).all()

    checked = len(rows)
    notified = skipped = emails = 0

    for task, assignee, project_name in rows:
        recent_exists = await session.scalar(
            select(
                exists().where(
                    and_(
                        Notification.notification_type
                        == NotificationType.TAREA_POR_VENCER,
                        Notification.user_to_id == assignee.id,
                        Notification.payload["task_id"].astext == str(task.id),
                        Notification.created_at >= cutoff,
                    )
                )
            )
        )
        if recent_exists:
            skipped += 1
            continue

        days_left = (task.due_date - today).days
        task_url = _task_url(public_url, task)

        session.add(
            Notification(
                user_to_id=assignee.id,
                notification_type=NotificationType.TAREA_POR_VENCER,
                message=(
                    f'La tarea "{task.title}" vence en {days_left} '
                    f"{'día' if days_left == 1 else 'días'}."
                ),
                payload={
                    "task_id": str(task.id),
                    "project_id": str(task.project_id),
                    "work_item_id": (
                        str(task.work_item_id) if task.work_item_id else None
                    ),
                    "days_left": days_left,
                },
            )
        )
        notified += 1

        mail = due_soon_task_email(
            name=assignee.name,
            task_title=task.title,
            project_name=project_name,
            due_date=task.due_date,
            days_left=days_left,
            task_url=task_url,
        )
        try:
            await email_sender.send(
                to=assignee.email,
                subject=mail.subject,
                body=mail.text,
                html=mail.html,
            )
            emails += 1
        except Exception:  # noqa: BLE001 - un correo caído no aborta el barrido
            logger.error(
                "Fallo al enviar correo de tarea por vencer",
                task_id=str(task.id),
                exc_info=True,
            )

    await session.flush()
    result = DueSoonScanResult(
        checked=checked,
        notified=notified,
        skipped_cooldown=skipped,
        emails_sent=emails,
    )
    logger.info(
        "Barrido de tareas por vencer",
        checked=result.checked,
        notified=result.notified,
        skipped_cooldown=result.skipped_cooldown,
        emails_sent=result.emails_sent,
    )
    return result
