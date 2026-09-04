"""`DeliverableNotifier.review_decided`: cada decisión de revisión
(aprobar / pedir cambios / rechazar) dispara un tipo de notificación distinto
para quien entregó. Sin equipo (`team_id=None`, caso de un entregable
personal) el toggle por-equipo no aplica y el aviso siempre pasa.
"""

import uuid

from app.modules.notifications.infrastructure.enums import NotificationType
from app.modules.teams.application.workspace_notifications import DeliverableNotifier
from app.modules.teams.infrastructure.workspace_enums import CommentType


class FakeSession:
    """Doble mínimo: solo lo que `review_decided` toca (`add`, y `scalar` para
    que `TeamNotificationGate` no reviente si algún día se le pasa team_id)."""

    def __init__(self) -> None:
        self.added: list = []

    def add(self, obj) -> None:
        self.added.append(obj)

    async def scalar(self, *_args, **_kwargs):
        return None


class TestReviewDecidedNotifications:
    async def _notifier(self) -> tuple[DeliverableNotifier, FakeSession, list]:
        session = FakeSession()
        broadcaster = _SpyBroadcaster()
        notifier = DeliverableNotifier(
            session=session, broadcaster=broadcaster, email_sender=_NullSender()
        )
        return notifier, session, broadcaster.published

    async def test_aprobacion_notifies_owner_with_completada(self):
        notifier, session, published = await self._notifier()
        owner_id = uuid.uuid4()
        reviewer_id = uuid.uuid4()

        await notifier.review_decided(
            owner_id=owner_id,
            reviewer_id=reviewer_id,
            decision=CommentType.APROBACION,
            team_id=None,
            deliverable_id=uuid.uuid4(),
            task_id=uuid.uuid4(),
        )

        assert len(session.added) == 1
        notification = session.added[0]
        assert notification.user_to_id == owner_id
        assert notification.notification_type == NotificationType.TAREA_COMPLETADA
        assert len(published) == 1

    async def test_solicitud_cambio_notifies_owner_with_devuelta(self):
        notifier, session, _ = await self._notifier()

        await notifier.review_decided(
            owner_id=uuid.uuid4(),
            reviewer_id=uuid.uuid4(),
            decision=CommentType.SOLICITUD_CAMBIO,
            team_id=None,
            deliverable_id=uuid.uuid4(),
            task_id=uuid.uuid4(),
        )

        assert session.added[0].notification_type == NotificationType.TAREA_DEVUELTA

    async def test_rechazo_notifies_owner_with_rechazada(self):
        notifier, session, _ = await self._notifier()

        await notifier.review_decided(
            owner_id=uuid.uuid4(),
            reviewer_id=uuid.uuid4(),
            decision=CommentType.RECHAZO,
            team_id=None,
            deliverable_id=uuid.uuid4(),
            task_id=uuid.uuid4(),
        )

        assert session.added[0].notification_type == NotificationType.TAREA_RECHAZADA

    async def test_self_review_does_not_notify(self):
        notifier, session, published = await self._notifier()
        same_user = uuid.uuid4()

        await notifier.review_decided(
            owner_id=same_user,
            reviewer_id=same_user,
            decision=CommentType.RECHAZO,
            team_id=None,
            deliverable_id=uuid.uuid4(),
            task_id=uuid.uuid4(),
        )

        assert session.added == []
        assert published == []


class _SpyBroadcaster:
    def __init__(self) -> None:
        self.published: list = []

    async def publish(self, channel: str, message: str) -> None:
        self.published.append((channel, message))


class _NullSender:
    async def send(self, **_kwargs) -> None:
        return None
