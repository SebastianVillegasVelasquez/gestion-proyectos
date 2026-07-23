from typing import AsyncIterator

from redis.asyncio import Redis

from app.core.logger import get_logger
from app.shared.broadcasting.broadcaster import Broadcaster

logger = get_logger(__name__)


class RedisBroadcaster(Broadcaster):
    def __init__(self, url: str) -> None:
        self._client: Redis | None = None
        self._url = url

    async def connect(self) -> None:
        client = Redis.from_url(self._url, decode_responses=True)
        try:
            if not await client.ping():
                raise RuntimeError(f"Redis PING no respondió PONG en {self._url}")
        except Exception:
            await client.aclose()
            raise
        self._client = client

    async def disconnect(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    async def publish(self, channel: str, message: str) -> None:
        if self._client is None:
            raise RuntimeError(
                "Broadcaster no está conectado. Llama connect() primero."
            )
        await self._client.publish(channel, message)

    async def subscribe(self, channel: str) -> AsyncIterator[str]:
        if self._client is None:
            raise RuntimeError(
                "Broadcaster no esta conectado. Llama connect() primero."
            )
        pubsub = self._client.pubsub()
        await pubsub.subscribe(channel)
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    yield message["data"]
        finally:
            try:
                await pubsub.unsubscribe(channel)
            except Exception:
                logger.exception("Error unsubscribing from Redis channel %s", channel)
            try:
                await pubsub.aclose()
            except Exception:
                logger.exception("Error closing Redis pubsub")
