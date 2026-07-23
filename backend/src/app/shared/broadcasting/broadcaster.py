from abc import ABC, abstractmethod
from typing import AsyncIterator


class Broadcaster(ABC):
    async def __aenter__(self):
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        await self.disconnect()

    @abstractmethod
    async def connect(self) -> None: ...

    @abstractmethod
    async def disconnect(self) -> None: ...

    @abstractmethod
    async def publish(self, channel: str, message: str) -> None: ...

    # Sin `async` a propósito: las implementaciones son generadores asíncronos
    # (async def + yield), cuyo tipo real es `def (...) -> AsyncIterator[str]`.
    # Declararlo `async def` aquí lo convertiría en "corrutina que devuelve un
    # iterador" y rompería el `async for` de los consumidores.
    @abstractmethod
    def subscribe(self, channel: str) -> AsyncIterator[str]: ...
