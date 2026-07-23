"""Tests del RedisBroadcaster contra un Redis real.

Se saltan automáticamente (skip) si no hay Redis alcanzable, para no romper
la suite en entornos sin la infraestructura levantada. Con `docker compose up`
(o Redis local) sí se ejecutan y validan el round-trip real de pub/sub.
"""

import asyncio
import uuid

import pytest

from app.core.config import get_settings
from app.shared.broadcasting.redis import RedisBroadcaster


@pytest.fixture
async def redis_broadcaster():
    broadcaster = RedisBroadcaster(get_settings().REDIS_URL)
    try:
        await broadcaster.connect()
    except Exception:
        pytest.skip("Redis no disponible en este entorno")
    yield broadcaster
    await broadcaster.disconnect()


class TestRedisBroadcaster:
    async def test_publish_subscribe_round_trip(self, redis_broadcaster):
        channel = f"test:{uuid.uuid4()}"
        received: list[str] = []

        async def consume():
            async for message in redis_broadcaster.subscribe(channel):
                received.append(message)
                break

        task = asyncio.create_task(consume())
        # Redis tarda un instante en registrar la suscripción del lado servidor.
        await asyncio.sleep(0.2)

        await redis_broadcaster.publish(channel, "hola-redis")
        await asyncio.wait_for(task, timeout=2)

        assert received == ["hola-redis"]

    async def test_publish_without_connect_raises(self):
        broadcaster = RedisBroadcaster(get_settings().REDIS_URL)
        with pytest.raises(RuntimeError):
            await broadcaster.publish("ch", "msg")
