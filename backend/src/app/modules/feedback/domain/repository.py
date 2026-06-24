from abc import ABC, abstractmethod

from app.modules.feedback.infrastructure.models import Feedback


class FeedbackRepository(ABC):
    """Contrato del repositorio de feedback (Dependency Inversion).

    Las use cases dependen de esta abstracción, no de SQLAlchemy; así se puede
    inyectar un fake en tests y cambiar la persistencia sin tocar el dominio.
    """

    @abstractmethod
    async def add(self, feedback: Feedback) -> Feedback: ...

    @abstractmethod
    async def list(self, limit: int, offset: int) -> tuple[list[Feedback], int]:
        """Lista paginada (más reciente primero) y total. Para administración."""
