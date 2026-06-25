from abc import ABC, abstractmethod
from uuid import UUID

from app.modules.feedback.infrastructure.models import Feedback


class FeedbackRepository(ABC):
    """Contrato del repositorio de feedback (Dependency Inversion).

    Las use cases dependen de esta abstracción, no de SQLAlchemy; así se puede
    inyectar un fake en tests y cambiar la persistencia sin tocar el dominio.
    """

    @abstractmethod
    async def add(self, feedback: Feedback) -> Feedback: ...

    @abstractmethod
    async def get(self, feedback_id: UUID) -> Feedback | None:
        """Trae un feedback con su autor (selectinload) para construir la respuesta."""

    @abstractmethod
    async def save(self, feedback: Feedback) -> Feedback: ...

    @abstractmethod
    async def list(self, limit: int, offset: int) -> tuple[list[Feedback], int]:
        """Lista paginada (más reciente primero) y total. Para el developer."""
