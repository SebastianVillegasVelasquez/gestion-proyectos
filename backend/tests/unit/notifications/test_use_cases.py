import datetime
import uuid

import pytest

from app.modules.notifications.infrastructure.enums import NotificationType
from app.shared.events.events import TaskCreated, TaskSubmitted


class TestNotificationUseCases:
    async def test_notification_should_be_create_by_created_task(
        self,
        fake_notification_repo,
        fake_bus_driven,
    ):
        assigned_id = uuid.uuid4()

        event = TaskCreated(
            assigned_id=assigned_id,
            work_item_id=uuid.uuid4(),
            task_id=uuid.uuid4(),
            occurred_at=datetime.datetime.now(datetime.timezone.utc),
        )

        await fake_bus_driven.publish(event)

        notifications, total = await fake_notification_repo.list_for_user(
            user_id=assigned_id, only_unread=False, limit=10, offset=0
        )
        assert total == 1
        notification = notifications[0]
        assert notification.user_to_id == assigned_id
        assert notification.notification_type == NotificationType.TAREA_ASIGNADA

    async def test_notification_uses_subtarea_type_when_task_is_subtask(
        self,
        fake_notification_repo,
        fake_bus_driven,
    ):
        assigned_id = uuid.uuid4()

        event = TaskCreated(
            assigned_id=assigned_id,
            work_item_id=uuid.uuid4(),
            task_id=uuid.uuid4(),
            is_subtask=True,
            occurred_at=datetime.datetime.now(datetime.timezone.utc),
        )

        await fake_bus_driven.publish(event)

        notifications, total = await fake_notification_repo.list_for_user(
            user_id=assigned_id, only_unread=False, limit=10, offset=0
        )
        assert total == 1
        assert notifications[0].notification_type == NotificationType.SUBTAREA_ASIGNADA

    @pytest.mark.xfail(
        reason=(
            "TaskCreated no lleva 'created_by', así que el handler no puede saber "
            "si el asignado es quien creó la tarea y no puede evitar auto-notificar. "
            "Regla de negocio pendiente: si se quiere, añadir created_by al evento "
            "y un guard como el de NotifyOnMemberAssignedToProject."
        ),
        strict=True,
    )
    async def test_notification_not_created_when_user_assigns_to_himself(
        self,
        fake_notification_repo,
        fake_bus_driven,
    ):
        same_user = uuid.uuid4()

        event = TaskCreated(
            assigned_id=same_user,
            work_item_id=uuid.uuid4(),
            task_id=uuid.uuid4(),
            occurred_at=datetime.datetime.now(datetime.timezone.utc),
        )

        await fake_bus_driven.publish(event)

        assert await fake_notification_repo.count_unread(same_user) == 0

    async def test_notification_should_be_created_by_task_submitted(
        self,
        fake_notification_repo,
        fake_bus_driven,
    ):
        assigned_id = uuid.uuid4()

        event = TaskSubmitted(
            assigned_id=assigned_id,
            work_item_id=uuid.uuid4(),
            task_id=uuid.uuid4(),
            occurred_at=datetime.datetime.now(datetime.timezone.utc),
        )

        # Dos entregas → dos notificaciones (no hay deduplicación por diseño).
        await fake_bus_driven.publish(event)
        await fake_bus_driven.publish(event)

        _, total = await fake_notification_repo.list_for_user(
            user_id=assigned_id, only_unread=False, limit=10, offset=0
        )
        assert total == 2
