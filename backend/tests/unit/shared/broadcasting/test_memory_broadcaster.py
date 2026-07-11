"""Tests del InMemoryBroadcaster (pub/sub en memoria).

Verifican el comportamiento de pub/sub que también implementa Redis por debajo:
entrega a suscriptores, fan-out a varios, no-op sin suscriptores y limpieza de
canales vacíos al cancelar una suscripción.
"""

import asyncio

from app.shared.broadcasting.memory import InMemoryBroadcaster


async def _wait_for(condition, timeout: float = 1.0) -> None:
    """Espera activa (con cesión al event loop) hasta que se cumpla `condition`."""
    elapsed = 0.0
    step = 0.01
    while elapsed < timeout:
        if condition():
            return
        await asyncio.sleep(step)
        elapsed += step
    raise AssertionError("La condición no se cumplió dentro del timeout")


class TestInMemoryBroadcaster:
    async def test_publish_delivers_to_subscriber(self):
        broadcaster = InMemoryBroadcaster()
        await broadcaster.connect()
        channel = "ch:1"
        received: list[str] = []

        async def consume():
            async for message in broadcaster.subscribe(channel):
                received.append(message)
                break

        task = asyncio.create_task(consume())
        await _wait_for(lambda: channel in broadcaster._subscribers)

        await broadcaster.publish(channel, "hola")
        await asyncio.wait_for(task, timeout=1)

        assert received == ["hola"]

    async def test_multiple_subscribers_each_receive(self):
        broadcaster = InMemoryBroadcaster()
        channel = "ch:multi"
        got_a: list[str] = []
        got_b: list[str] = []

        async def consume(sink: list[str]):
            async for message in broadcaster.subscribe(channel):
                sink.append(message)
                break

        task_a = asyncio.create_task(consume(got_a))
        task_b = asyncio.create_task(consume(got_b))
        await _wait_for(lambda: len(broadcaster._subscribers.get(channel, [])) == 2)

        await broadcaster.publish(channel, "ping")
        await asyncio.wait_for(asyncio.gather(task_a, task_b), timeout=1)

        assert got_a == ["ping"]
        assert got_b == ["ping"]

    async def test_publish_without_subscribers_is_noop(self):
        broadcaster = InMemoryBroadcaster()
        # No debe lanzar ni crear la clave (evita fugas de memoria).
        await broadcaster.publish("ghost", "nadie escucha")
        assert "ghost" not in broadcaster._subscribers

    async def test_subscription_cleanup_removes_empty_channel(self):
        broadcaster = InMemoryBroadcaster()
        channel = "ch:cleanup"

        async def consume():
            async for _ in broadcaster.subscribe(channel):
                pass

        task = asyncio.create_task(consume())
        await _wait_for(lambda: channel in broadcaster._subscribers)

        # Cancelar dispara el finally del generador → limpia la cola y la clave.
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

        assert channel not in broadcaster._subscribers
