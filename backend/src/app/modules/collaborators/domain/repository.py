from abc import ABC, abstractmethod
from uuid import UUID

from app.modules.collaborators.domain.models import (
    CollaboratorCounts,
    CollaboratorHistoryRead,
    CollaboratorIdentity,
    CollaboratorRow,
    CollaboratorTaskRead,
)


class CollaboratorRepository(ABC):
    """Contrato de acceso a datos de colaboradores (Dependency Inversion).

    Expone consultas atómicas. La composición del agregado y las reglas viven
    en el servicio, no aquí: el repositorio solo lee datos.
    """

    @abstractmethod
    async def count_collaborators(self, search: str | None) -> int: ...

    @abstractmethod
    async def list_collaborator_rows(
        self, search: str | None, limit: int, offset: int
    ) -> list[CollaboratorRow]: ...

    @abstractmethod
    async def get_identity(self, user_id: UUID) -> CollaboratorIdentity | None: ...

    @abstractmethod
    async def get_status_counts(self, user_id: UUID) -> CollaboratorCounts: ...

    @abstractmethod
    async def count_projects(self, user_id: UUID) -> int: ...

    @abstractmethod
    async def count_teams(self, user_id: UUID) -> int: ...

    @abstractmethod
    async def list_assigned_tasks(
        self, user_id: UUID, limit: int
    ) -> list[CollaboratorTaskRead]: ...

    @abstractmethod
    async def list_history(
        self, user_id: UUID, limit: int
    ) -> list[CollaboratorHistoryRead]: ...
