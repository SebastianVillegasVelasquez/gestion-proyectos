"""Rate limiting simple en memoria (sin dependencias externas).

Pensado para proteger endpoints sensibles (p. ej. login) de fuerza bruta. Es
por-proceso: con varios workers/instancias el límite es por worker. Para MVP de
una sola instancia es suficiente; en escala, mover a Redis.
"""

import time
from collections import defaultdict, deque

from fastapi import Depends, Request

from app.shared.exceptions import DomainException


class TooManyRequestsError(DomainException):
    """429: demasiados intentos en la ventana de tiempo."""


_HITS: dict[str, deque[float]] = defaultdict(deque)


def _allow(key: str, max_hits: int, window_seconds: float) -> bool:
    now = time.monotonic()
    hits = _HITS[key]
    # Descarta los intentos fuera de la ventana deslizante.
    while hits and now - hits[0] > window_seconds:
        hits.popleft()
    if len(hits) >= max_hits:
        return False
    hits.append(now)
    return True


def rate_limiter(max_hits: int, window_seconds: float, scope: str):
    """Crea una dependencia de FastAPI que limita por IP del cliente.

    `scope` separa contadores entre endpoints (p. ej. "login").
    """

    async def _dependency(request: Request) -> None:
        client = request.client.host if request.client else "unknown"
        if not _allow(f"{scope}:{client}", max_hits, window_seconds):
            raise TooManyRequestsError(
                "Demasiados intentos. Espera un momento e inténtalo de nuevo."
            )

    return Depends(_dependency)
