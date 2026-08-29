"""Barrido de tareas atrasadas: notificación + correo, con anti-spam por cooldown."""

import datetime
import uuid

from app.modules.identity.infrastructure.enums import SystemRole
from app.modules.identity.infrastructure.models import User
from app.modules.notifications.application.overdue_scan import scan_overdue_tasks
from app.modules.notifications.infrastructure.enums import NotificationType
from app.modules.notifications.infrastructure.models import Notification
from app.modules.project.infrastructure.models import Project
from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.tasks.infrastructure.models import Task


class FakeEmailSender:
    def __init__(self) -> None:
        self.sent: list[dict] = []

    async def send(self, *, to, subject, body, html=None) -> None:
        self.sent.append({"to": to, "subject": subject, "body": body, "html": html})


async def _seed_overdue_task(db_session, *, days_overdue: int = 3) -> Task:
    user = User(
        email=f"resp-{uuid.uuid4().hex[:8]}@example.com",
        password="x",
        name="Reyna",
        last_name="Test",
        role=SystemRole.USER,
        position="sin_cargo",
        is_active=True,
    )
    project = Project(name="Proyecto atrasado")
    db_session.add_all([user, project])
    await db_session.flush()

    # El barrido usa la fecha UTC como referencia; sembramos con la misma base
    # para que `days_overdue` sea determinista sin importar la hora local.
    today_utc = datetime.datetime.now(datetime.timezone.utc).date()
    task = Task(
        title="Grabar módulo 2",
        status=TaskStatus.EN_PROGRESO,
        project_id=project.id,
        assignee_id=user.id,
        due_date=today_utc - datetime.timedelta(days=days_overdue),
    )
    db_session.add(task)
    await db_session.flush()
    return task


class TestOverdueScan:
    async def test_notifies_and_emails_the_assignee_once(self, db_session):
        task = await _seed_overdue_task(db_session, days_overdue=3)
        mailer = FakeEmailSender()

        result = await scan_overdue_tasks(
            db_session, email_sender=mailer, public_url="http://app.test"
        )

        assert result.checked == 1
        assert result.notified == 1
        assert result.emails_sent == 1
        assert len(mailer.sent) == 1
        assert "atrasada" in mailer.sent[0]["subject"].lower()

        note = (
            await db_session.execute(
                Notification.__table__.select().where(
                    Notification.notification_type == NotificationType.TAREA_ATRASADA
                )
            )
        ).first()
        assert note is not None
        assert note.payload["task_id"] == str(task.id)
        assert note.payload["days_overdue"] == 3

    async def test_second_run_within_cooldown_does_not_duplicate(self, db_session):
        await _seed_overdue_task(db_session, days_overdue=2)
        mailer = FakeEmailSender()

        first = await scan_overdue_tasks(db_session, email_sender=mailer)
        second = await scan_overdue_tasks(db_session, email_sender=mailer)

        assert first.notified == 1
        assert second.notified == 0
        assert second.skipped_cooldown == 1
        assert len(mailer.sent) == 1

    async def test_completed_tasks_are_ignored(self, db_session):
        task = await _seed_overdue_task(db_session, days_overdue=5)
        task.status = TaskStatus.COMPLETADA
        await db_session.flush()
        mailer = FakeEmailSender()

        result = await scan_overdue_tasks(db_session, email_sender=mailer)

        assert result.checked == 0
        assert result.notified == 0
