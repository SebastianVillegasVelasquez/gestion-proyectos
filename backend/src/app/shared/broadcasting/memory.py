import asyncio
from collections import defaultdict
from typing import AsyncIterator

from app.shared.broadcasting.broadcaster import Broadcaster


class InMemoryBroadcaster(Broadcaster):
    def __init__(self):
        self._subscribers: dict[str, list[asyncio.Queue[str]]] = defaultdict(list)

    async def connect(self) -> None:
        pass

    async def disconnect(self) -> None:
        self._subscribers.clear()

    async def publish(self, channel: str, message: str) -> None:
        for queue in self._subscribers.get(channel, []):
            queue.put_nowait(message)

    async def subscribe(self, channel: str) -> AsyncIterator[str]:
        queue: asyncio.Queue[str] = asyncio.Queue()
        self._subscribers[channel].append(queue)
        try:
            while True:
                message = await queue.get()
                yield message
        finally:
            self._subscribers[channel].remove(queue)
            if not self._subscribers[channel]:
                del self._subscribers[channel]
