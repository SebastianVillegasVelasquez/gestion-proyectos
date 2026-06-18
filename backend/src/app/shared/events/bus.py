from collections import defaultdict
from typing import Awaitable, Callable, Type, TypeVar

from app.core.logger import get_logger
from app.shared.events.events import DomainEvent

logger = get_logger(__name__)

E = TypeVar("E", bound=DomainEvent)
EventHandler = Callable[[E], Awaitable[None]]


class EventBus:
    """Dispatcher de eventos in-process (Stage 0).

    Es un `dict` que mapea tipo-de-evento → lista de handlers async. Al publicar
    recorre la lista y los invoca. Vive en memoria; si reinicias el proceso, el
    bus arranca vacío — los handlers se registran al inicio de cada request.

    Aislamiento de fallos: un handler que explota NO tumba a los demás ni al
    use case que publicó el evento. Trade-off consciente para Stage 0; cuando
    haya que garantizar entrega exactly-once introducimos el patrón Outbox.
    """

    def __init__(self) -> None:
        self._handlers: dict[Type[DomainEvent], list[EventHandler]] = defaultdict(list)

    def subscribe(self, event_type: Type[E], handler: EventHandler) -> None:
        self._handlers[event_type].append(handler)

    async def publish(self, event: DomainEvent) -> None:
        for handler in self._handlers[type(event)]:
            try:
                await handler(event)
            except Exception:
                logger.error(
                    "Handler falló procesando evento",
                    handler=getattr(handler, "__name__", repr(handler)),
                    event=type(event).__name__,
                    exc_info=True,
                )
