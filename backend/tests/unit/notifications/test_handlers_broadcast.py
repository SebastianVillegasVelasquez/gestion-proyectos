"""Tests de que los handlers de notificaciones publican al broadcaster.

Verifican el contrato del canal (`notifications:user:{id}`) y del mensaje
mínimo (`{"type": "notification.new"}`), además de la regla de negocio de no
auto-notificarse. Usan el `spy_broadcaster` (fixture) para inspeccionar publishes.
"""

import datetime
import json
import uuid

from app.modules.notifications.application.handlers import (
    NotifyOnMemberAssignedToProject,
    NotifyOnTaskCreated,
    channel_for,
)
from app.modules.project.infrastructure.enums import ProjectRole
from app.shared.events.events import MemberAssigned, TaskCreated

NEW_EVENT_MESSAGE = json.dumps({"type": "notification.new"})


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


class TestHandlersBroadcast:
    async def test_task_created_publishes_new_event(
        self, fake_notification_repo, spy_broadcaster
    ):
        handler = NotifyOnTaskCreated(fake_notification_repo, spy_broadcaster)
        assigned_id = uuid.uuid4()

        await handler(
            TaskCreated(
                assigned_id=assigned_id,
                work_item_id=uuid.uuid4(),
                task_id=uuid.uuid4(),
                occurred_at=_now(),
            )
        )

        assert spy_broadcaster.published == [
            (channel_for(assigned_id), NEW_EVENT_MESSAGE)
        ]

    async def test_member_assignment_publishes_to_target_user(
        self, fake_notification_repo, spy_broadcaster
    ):
        target = uuid.uuid4()
        actor = uuid.uuid4()
        handler = NotifyOnMemberAssignedToProject(
            fake_notification_repo, spy_broadcaster
        )

        await handler(
            MemberAssigned(
                project_id=uuid.uuid4(),
                user_id=target,
                project_role=ProjectRole.INTEGRANTE,
                assigned_by=actor,
                occurred_at=_now(),
            )
        )

        assert spy_broadcaster.published == [(channel_for(target), NEW_EVENT_MESSAGE)]

    async def test_member_self_assignment_does_not_publish(
        self, fake_notification_repo, spy_broadcaster
    ):
        same_user = uuid.uuid4()
        handler = NotifyOnMemberAssignedToProject(
            fake_notification_repo, spy_broadcaster
        )

        await handler(
            MemberAssigned(
                project_id=uuid.uuid4(),
                user_id=same_user,
                project_role=ProjectRole.INTEGRANTE,
                assigned_by=same_user,
                occurred_at=_now(),
            )
        )

        assert spy_broadcaster.published == []
        assert await fake_notification_repo.count_unread(same_user) == 0
