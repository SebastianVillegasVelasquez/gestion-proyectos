from abc import ABC, abstractmethod
from uuid import UUID

from app.modules.project.structure.infrastructure.models import (
    TipoNodo,
    WorkItem,
    WorkItemDependency,
)


class WorkTreeRepository(ABC):
    """Contrato de persistencia del árbol de trabajo (Dependency Inversion).

    El servicio depende de esta abstracción, no de SQLAlchemy: así se inyectan
    fakes en los tests y la infraestructura es intercambiable.
    """

    # ── Tipos de nodo ─────────────────────────────────────────────────────────
    @abstractmethod
    async def add_tipo(self, tipo: TipoNodo) -> TipoNodo: ...

    @abstractmethod
    async def save_tipo(self, tipo: TipoNodo) -> TipoNodo: ...

    @abstractmethod
    async def get_tipo(self, tipo_id: UUID) -> TipoNodo | None: ...

    @abstractmethod
    async def get_tipo_by_nombre(
        self, proyecto_id: UUID | None, nombre: str
    ) -> TipoNodo | None: ...

    @abstractmethod
    async def list_tipos(self, proyecto_id: UUID) -> list[TipoNodo]: ...

    # ── Nodos de trabajo ──────────────────────────────────────────────────────
    @abstractmethod
    async def add_item(self, item: WorkItem) -> WorkItem: ...

    @abstractmethod
    async def save_item(self, item: WorkItem) -> WorkItem: ...

    @abstractmethod
    async def get_item(self, item_id: UUID) -> WorkItem | None: ...

    @abstractmethod
    async def list_items(self, proyecto_id: UUID) -> list[WorkItem]: ...

    @abstractmethod
    async def next_orden(self, proyecto_id: UUID, parent_id: UUID | None) -> int: ...

    @abstractmethod
    async def soft_delete_many(self, item_ids: list[UUID]) -> None: ...

    @abstractmethod
    async def list_deleted_items(self, proyecto_id: UUID) -> list[WorkItem]: ...

    @abstractmethod
    async def restore_many(self, item_ids: list[UUID]) -> None: ...

    # ── Dependencias Finish-to-Start ──────────────────────────────────────────
    @abstractmethod
    async def add_dependency(
        self, dependency: WorkItemDependency
    ) -> WorkItemDependency: ...

    @abstractmethod
    async def get_dependency(
        self, work_item_id: UUID, depends_on_id: UUID
    ) -> WorkItemDependency | None: ...

    @abstractmethod
    async def delete_dependency(self, dependency: WorkItemDependency) -> None: ...

    @abstractmethod
    async def list_dependencies(
        self, work_item_id: UUID
    ) -> list[WorkItemDependency]: ...

    @abstractmethod
    async def list_predecessors(self, work_item_id: UUID) -> list[WorkItem]: ...

    @abstractmethod
    async def list_dependency_edges(
        self, proyecto_id: UUID
    ) -> list[tuple[UUID, UUID]]: ...
