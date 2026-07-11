"""Tests del ConnectionManager.

Usa el InMemoryBroadcaster real + WebSockets falsos para verificar el ciclo de
vida: registrar conexiones, relay de mensajes, fan-out a varias pestañas,
cancelación de la task al desconectar la última, y shutdown global.
"""

import asyncio

from app.shared.broadcasting.memory import InMemoryBroadcaster
from app.shared.connection_manager.connection_manager import ConnectionManager


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
    """Stub mínimo: registra lo enviado y avisa cuando llega un mensaje."""

    def __init__(self) -> None:
        self.sent: list[str] = []
        self.received = asyncio.Event()

    async def send_text(self, message: str) -> None:
        self.sent.append(message)
        self.received.set()


class TestConnectionManager:
    async def test_connect_registers_and_relays_message(self):
        broadcaster = InMemoryBroadcaster()
        manager = ConnectionManager(broadcaster)
        ws = FakeWebSocket()
        channel = "notifications:user:1"

        await manager.connect(channel, ws)
        await _wait_for(lambda: channel in broadcaster._subscribers)

        await broadcaster.publish(channel, "hola")
        await asyncio.wait_for(ws.received.wait(), timeout=1)

        assert ws.sent == ["hola"]
        await manager.shutdown()

    async def test_two_tabs_same_channel_both_receive(self):
        broadcaster = InMemoryBroadcaster()
        manager = ConnectionManager(broadcaster)
        ws1, ws2 = FakeWebSocket(), FakeWebSocket()
        channel = "notifications:user:2"

        await manager.connect(channel, ws1)
        await manager.connect(channel, ws2)
        await _wait_for(lambda: channel in broadcaster._subscribers)

        await broadcaster.publish(channel, "ping")
        await asyncio.wait_for(ws1.received.wait(), timeout=1)
        await asyncio.wait_for(ws2.received.wait(), timeout=1)

        assert ws1.sent == ["ping"]
        assert ws2.sent == ["ping"]
        # Una sola task de relay por canal aunque haya 2 pestañas.
        assert len(manager._broadcast_tasks) == 1
        await manager.shutdown()

    async def test_last_disconnect_cancels_relay_task(self):
        broadcaster = InMemoryBroadcaster()
        manager = ConnectionManager(broadcaster)
        ws = FakeWebSocket()
        channel = "notifications:user:3"

        await manager.connect(channel, ws)
        await _wait_for(lambda: channel in broadcaster._subscribers)

        await manager.disconnect(channel, ws)

        assert channel not in manager._connections
        assert channel not in manager._broadcast_tasks
        # El cleanup del generador debe haber desuscrito del broadcaster.
        await _wait_for(lambda: channel not in broadcaster._subscribers)

    async def test_shutdown_cancels_all_tasks(self):
        broadcaster = InMemoryBroadcaster()
        manager = ConnectionManager(broadcaster)
        await manager.connect("notifications:user:4", FakeWebSocket())
        await manager.connect("notifications:user:5", FakeWebSocket())
        await _wait_for(lambda: len(manager._broadcast_tasks) == 2)

        await manager.shutdown()

        assert manager._broadcast_tasks == {}
        assert manager._connections == {}
