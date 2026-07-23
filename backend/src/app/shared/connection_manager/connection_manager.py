import asyncio
from collections import defaultdict

from fastapi.websockets import WebSocket

from app.core.logger import get_logger
from app.shared.broadcasting.broadcaster import Broadcaster

logger = get_logger(__name__)


class ConnectionManager:
    def __init__(self, broadcaster: Broadcaster):
        """Maneja las conexiones WebSocket y las notificaciones de Redis."""
        self._broadcaster = broadcaster
        self._connections: dict[str, list[WebSocket]] = defaultdict(list)
        self._broadcast_tasks: dict[str, asyncio.Task] = {}

    async def connect(self, channel: str, ws: WebSocket) -> None:
        """Registra la WS y arranca la task de Redis si es la primera del usuario."""
        if ws not in self._connections[channel]:  # No existen conexiones previas
            self._connections[channel].append(ws)

            if channel not in self._broadcast_tasks:
                self._broadcast_tasks[channel] = asyncio.create_task(
                    self._relay_loop(channel)
                )

    async def disconnect(self, channel: str, ws: WebSocket) -> None:
        """Quita la WS y cancela la task de Redis si era la última del usuario."""
        if channel not in self._connections:
            return

        try:
            self._connections[channel].remove(ws)  # Se desconecta el WebSocket
        except ValueError:
            pass

        if not self._connections[channel]:
            del self._connections[channel]
            task = self._broadcast_tasks.pop(channel, None)
            if task is None:
                return

            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    async def _relay_loop(self, channel: str) -> None:
        """Escucha el canal Redis del usuario y reenvía a sus WSs locales."""
        try:
            async for message in self._broadcaster.subscribe(channel):
                for ws in list(self._connections.get(channel, [])):
                    try:
                        await ws.send_text(message)
                    except Exception:
                        logger.warning("Error sending message to WebSocket")
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Relay loop failed for channel %s", channel)

    async def shutdown(self) -> None:
        """Cancela todas las tasks pendientes. Se llama en el lifespan al apagar."""
        logger.info(
            "Shutting down ConnectionManager: %d active channels",
            len(self._broadcast_tasks),
        )
        tasks = list(self._broadcast_tasks.values())

        for task in tasks:
            task.cancel()

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        self._broadcast_tasks.clear()
        self._connections.clear()
