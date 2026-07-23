"""End-to-end en memoria de las notificaciones en tiempo real.

Ejercita la cadena COMPLETA sin Redis ni servidor reales:

    evento de dominio → EventBus → handler → broadcaster
                      → ConnectionManager → WebSocket

Es la prueba que demuestra que todas las piezas encajan. Para el camino con
Redis real, ver `broadcasting/test_redis_broadcaster.py`.
"""

import asyncio
import datetime
import json
import uuid

from app.modules.notifications.application.handlers import (
    NotifyOnTaskCreated,
    channel_for,
)
from app.shared.broadcasting.memory import InMemoryBroadcaster
from app.shared.connection_manager.connection_manager import ConnectionManager
from app.shared.events.bus import EventBus
from app.shared.events.events import TaskCreated


async def _wait_for(condition, timeout: float = 1.0) -> None:
    elapsed = 0.0
    step = 0.01
    while elapsed < timeout:
        if condition():
            return
        await asyncio.sleep(step)
        elapsed += step
    raise AssertionError("La condición no se cumplió dentro del timeout")


class FakeWebSocket:
    def __init__(self) -> None:
        self.sent: list[str] = []
        self.received = asyncio.Event()

    async def send_text(self, message: str) -> None:
        self.sent.append(message)
        self.received.set()


class TestRealtimeEndToEnd:
    async def test_domain_event_reaches_connected_websocket(
        self, fake_notification_repo
    ):
        broadcaster = InMemoryBroadcaster()
        manager = ConnectionManager(broadcaster)

        # Mismo broadcaster para el handler (publica) y el manager (relay).
        bus = EventBus()
        bus.subscribe(
            TaskCreated, NotifyOnTaskCreated(fake_notification_repo, broadcaster)
        )

        assigned_id = uuid.uuid4()
        channel = channel_for(assigned_id)

        ws = FakeWebSocket()
        await manager.connect(channel, ws)
        await _wait_for(lambda: channel in broadcaster._subscribers)

        await bus.publish(
            TaskCreated(
                assigned_id=assigned_id,
                work_item_id=uuid.uuid4(),
                task_id=uuid.uuid4(),
                occurred_at=datetime.datetime.now(datetime.timezone.utc),
            )
        )

        await asyncio.wait_for(ws.received.wait(), timeout=1)

        # 1) El WebSocket recibió el aviso mínimo (opción B).
        assert ws.sent == [json.dumps({"type": "notification.new"})]
        # 2) La notificación quedó persistida: la BD es la fuente de verdad.
        assert await fake_notification_repo.count_unread(assigned_id) == 1

        await manager.shutdown()
