"""Recordatorios personales: CRUD acotado al dueño + despacho por el worker."""

import datetime
import uuid

import pytest

from app.modules.identity.infrastructure.enums import SystemRole
from app.modules.identity.infrastructure.models import User
from app.modules.reminders.application.dispatch import dispatch_due_reminders
from app.modules.reminders.application.use_cases import ReminderService
from app.modules.reminders.infrastructure.enums import (
    ReminderChannel,
    ReminderStatus,
)
from app.modules.reminders.infrastructure.models import PersonalReminder
from app.modules.reminders.infrastructure.repository import (
    SqlAlchemyReminderRepository,
)
from app.modules.reminders.presentation.schemas import (
    CreateReminderRequest,
    UpdateReminderRequest,
)
from app.shared.exceptions import NotFoundError, ValidationError


class FakeEmailSender:
    def __init__(self):
        self.sent = []

    async def send(self, *, to, subject, body, html=None):
        self.sent.append({"to": to, "subject": subject})


async def _make_user(db) -> User:
    user = User(
        email=f"r-{uuid.uuid4().hex[:8]}@example.com",
        password="x",
        name="Rita",
        last_name="T",
        role=SystemRole.USER,
        position="sin_cargo",
        is_active=True,
    )
    db.add(user)
    await db.flush()
    return user


def _in(minutes: int) -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        minutes=minutes
    )


class TestReminderService:
    async def test_create_list_and_owner_scoping(self, db_session):
        u1 = await _make_user(db_session)
        u2 = await _make_user(db_session)
        svc = ReminderService(SqlAlchemyReminderRepository(db_session))

        created = await svc.create(
            u1.id,
            CreateReminderRequest(title="Llamar al cliente", remind_at=_in(60)),
        )
        assert created.status == ReminderStatus.PENDIENTE

        assert len(await svc.list_mine(u1.id, None)) == 1
        assert await svc.list_mine(u2.id, None) == []

        with pytest.raises(NotFoundError):
            await svc.cancel(created.id, u2.id)  # no es suyo

    async def test_past_dates_are_rejected_by_the_schema(self):
        with pytest.raises(ValueError):
            CreateReminderRequest(title="Tarde", remind_at=_in(-10))

    async def test_update_only_while_pending(self, db_session):
        u = await _make_user(db_session)
        svc = ReminderService(SqlAlchemyReminderRepository(db_session))
        r = await svc.create(
            u.id, CreateReminderRequest(title="Editar", remind_at=_in(30))
        )

        updated = await svc.update(r.id, u.id, UpdateReminderRequest(title="Editado"))
        assert updated.title == "Editado"

        await svc.cancel(r.id, u.id)
        with pytest.raises(ValidationError):
            await svc.update(r.id, u.id, UpdateReminderRequest(title="No"))


class TestReminderDispatch:
    async def test_due_reminder_creates_notification_and_is_marked_sent(
        self, db_session
    ):
        from sqlalchemy import select

        from app.modules.notifications.infrastructure.models import Notification

        u = await _make_user(db_session)
        # Insertamos con fecha pasada directamente (el schema lo prohibiría).
        reminder = PersonalReminder(
            user_id=u.id,
            title="Revisar guion",
            remind_at=_in(-1),
            channel=ReminderChannel.AMBOS,
            status=ReminderStatus.PENDIENTE,
        )
        db_session.add(reminder)
        await db_session.flush()

        mailer = FakeEmailSender()
        result = await dispatch_due_reminders(db_session, email_sender=mailer)

        assert result.due == 1
        assert result.notifications == 1
        assert result.emails == 1
        assert len(mailer.sent) == 1

        await db_session.refresh(reminder)
        assert reminder.status == ReminderStatus.ENVIADO
        assert reminder.sent_at is not None

        notes = (await db_session.execute(select(Notification))).scalars().all()
        assert len(notes) == 1
        assert notes[0].payload["reminder_id"] == str(reminder.id)

        # Segunda pasada: ya no está PENDIENTE -> no reenvía.
        again = await dispatch_due_reminders(db_session, email_sender=mailer)
        assert again.due == 0

    async def test_notification_only_channel_sends_no_email(self, db_session):
        u = await _make_user(db_session)
        reminder = PersonalReminder(
            user_id=u.id,
            title="Solo campanita",
            remind_at=_in(-1),
            channel=ReminderChannel.NOTIFICACION,
            status=ReminderStatus.PENDIENTE,
        )
        db_session.add(reminder)
        await db_session.flush()

        mailer = FakeEmailSender()
        result = await dispatch_due_reminders(db_session, email_sender=mailer)
        assert result.notifications == 1
        assert result.emails == 0
