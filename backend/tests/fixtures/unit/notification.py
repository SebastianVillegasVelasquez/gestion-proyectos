import datetime
import uuid
from typing import AsyncIterator
from uuid import UUID

import pytest

from app.modules.notifications.application.handlers import (
    NotifyOnMemberAssignedToProject,
    NotifyOnTaskCreated,
    NotifyOnTaskSubmitted,
)
from app.modules.notifications.domain.repository import NotificationRepository
from app.modules.notifications.infrastructure.models import Notification
from app.shared.broadcasting.broadcaster import Broadcaster
from app.shared.events.events import MemberAssigned
from app.shared.events.bus import EventBus
from app.shared.events.events import TaskCreated, TaskSubmitted


class FakeNotificationRepo(NotificationRepository):
    def __init__(self) -> None:
        self._storage: dict[UUID, Notification] = {}

    async def add(self, notification: Notification) -> Notification:
        if getattr(notification, "id", None) is None:
            notification.id = uuid.uuid4()
        self._storage[notification.id] = notification
        return notification

    async def get(self, notification_id: UUID) -> Notification | None:
        return self._storage.get(notification_id)

    async def list_for_user(
        self,
        user_id: UUID,
        only_unread: bool,
        limit: int,
        offset: int,
    ) -> tuple[list[Notification], int]:
        items = [n for n in self._storage.values() if n.user_to_id == user_id]
        if only_unread:
            items = [n for n in items if n.read_at is None]
        total = len(items)
        return items[offset : offset + limit], total

    async def count_unread(self, user_id: UUID) -> int:
        return sum(
            1
            for n in self._storage.values()
            if n.user_to_id == user_id and n.read_at is None
        )

    async def mark_as_read(self, notification: Notification) -> Notification:
        notification.read_at = datetime.datetime.now(datetime.timezone.utc)
        return notification

    async def mark_all_as_read(self, user_id: UUID) -> int:
        now = datetime.datetime.now(datetime.timezone.utc)
        updated = 0
        for n in self._storage.values():
            if n.user_to_id == user_id and n.read_at is None:
                n.read_at = now
                updated += 1
        return updated

    async def delete(self, notification: Notification) -> None:
        self._storage.pop(notification.id, None)


class SpyBroadcaster(Broadcaster):
    """Doble de test: registra cada publish sin tocar Redis.

    Permite verificar QUÉ se publicó y en QUÉ canal, sin infraestructura real.
    `subscribe` es un generador async vacío (no se usa en los tests de handlers).
    """

    def __init__(self) -> None:
        self.published: list[tuple[str, str]] = []
        self.connected = False

    async def connect(self) -> None:
        self.connected = True

    async def disconnect(self) -> None:
        self.connected = False

    async def publish(self, channel: str, message: str) -> None:
        self.published.append((channel, message))

    async def subscribe(self, channel: str) -> AsyncIterator[str]:
        return
        yield  # pragma: no cover  # marca la función como generador async


@pytest.fixture
def fake_notification_repo() -> FakeNotificationRepo:
    return FakeNotificationRepo()


@pytest.fixture
def spy_broadcaster() -> SpyBroadcaster:
    return SpyBroadcaster()


@pytest.fixture
def fake_bus_driven(
    fake_notification_repo: FakeNotificationRepo,
    spy_broadcaster: SpyBroadcaster,
) -> EventBus:
    bus = EventBus()
    bus.subscribe(
        TaskCreated, NotifyOnTaskCreated(fake_notification_repo, spy_broadcaster)
    )
    bus.subscribe(
        TaskSubmitted, NotifyOnTaskSubmitted(fake_notification_repo, spy_broadcaster)
    )
    bus.subscribe(
        MemberAssigned,
        NotifyOnMemberAssignedToProject(fake_notification_repo, spy_broadcaster),
    )
    return bus
