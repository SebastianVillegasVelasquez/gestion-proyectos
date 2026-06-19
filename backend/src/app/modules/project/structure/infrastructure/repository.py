from uuid import UUID

from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.project.structure.domain.repository import WorkTreeRepository
from app.modules.project.structure.infrastructure.models import (
    TipoNodo,
    WorkItem,
    WorkItemDependency,
)


class SqlAlchemyWorkTreeRepository(WorkTreeRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _persist(self, entity):
        self._session.add(entity)
        await self._session.flush()
        await self._session.refresh(entity)
        return entity

    # ── Tipos de nodo ─────────────────────────────────────────────────────────
    async def add_tipo(self, tipo: TipoNodo) -> TipoNodo:
        return await self._persist(tipo)

    async def save_tipo(self, tipo: TipoNodo) -> TipoNodo:
        return await self._persist(tipo)

    async def get_tipo(self, tipo_id: UUID) -> TipoNodo | None:
        return await self._session.get(TipoNodo, tipo_id)

    async def get_tipo_by_nombre(
        self, proyecto_id: UUID | None, nombre: str
    ) -> TipoNodo | None:
        condition = (
            TipoNodo.proyecto_id.is_(None)
            if proyecto_id is None
            else TipoNodo.proyecto_id == proyecto_id
        )
        result = await self._session.execute(
            select(TipoNodo).where(
                condition,
                TipoNodo.nombre == nombre,
                TipoNodo.deleted_at.is_(None),
            )
        )
        return result.scalars().first()

    async def list_tipos(self, proyecto_id: UUID) -> list[TipoNodo]:
        result = await self._session.execute(
            select(TipoNodo)
            .where(
                or_(
                    TipoNodo.proyecto_id == proyecto_id,
                    TipoNodo.proyecto_id.is_(None),
                ),
                TipoNodo.deleted_at.is_(None),
            )
            .order_by(TipoNodo.nombre)
        )
        return list(result.scalars().all())

    # ── Nodos de trabajo ──────────────────────────────────────────────────────
    async def add_item(self, item: WorkItem) -> WorkItem:
        return await self._persist(item)

    async def save_item(self, item: WorkItem) -> WorkItem:
        return await self._persist(item)

    async def get_item(self, item_id: UUID) -> WorkItem | None:
        result = await self._session.execute(
            select(WorkItem)
            .where(WorkItem.id == item_id)
            .options(selectinload(WorkItem.tipo))
        )
        return result.scalars().first()

    async def list_items(self, proyecto_id: UUID) -> list[WorkItem]:
        result = await self._session.execute(
            select(WorkItem)
            .where(
                WorkItem.proyecto_id == proyecto_id,
                WorkItem.deleted_at.is_(None),
            )
            .options(selectinload(WorkItem.tipo))
            .order_by(WorkItem.orden, WorkItem.created_at)
        )
        return list(result.scalars().all())

    async def next_orden(self, proyecto_id: UUID, parent_id: UUID | None) -> int:
        parent_condition = (
            WorkItem.parent_id.is_(None)
            if parent_id is None
            else WorkItem.parent_id == parent_id
        )
        current_max = await self._session.scalar(
            select(func.max(WorkItem.orden)).where(
                WorkItem.proyecto_id == proyecto_id,
                parent_condition,
                WorkItem.deleted_at.is_(None),
            )
        )
        return int(current_max) + 1 if current_max is not None else 0

    async def soft_delete_many(self, item_ids: list[UUID]) -> None:
        if not item_ids:
            return
        await self._session.execute(
            update(WorkItem)
            .where(WorkItem.id.in_(item_ids))
            .values(deleted_at=func.now())
        )
        await self._session.flush()

    # ── Dependencias Finish-to-Start ──────────────────────────────────────────
    async def add_dependency(
        self, dependency: WorkItemDependency
    ) -> WorkItemDependency:
        return await self._persist(dependency)

    async def get_dependency(
        self, work_item_id: UUID, depends_on_id: UUID
    ) -> WorkItemDependency | None:
        result = await self._session.execute(
            select(WorkItemDependency).where(
                WorkItemDependency.work_item_id == work_item_id,
                WorkItemDependency.depends_on_id == depends_on_id,
            )
        )
        return result.scalars().first()

    async def delete_dependency(self, dependency: WorkItemDependency) -> None:
        await self._session.delete(dependency)
        await self._session.flush()

    async def list_dependencies(self, work_item_id: UUID) -> list[WorkItemDependency]:
        result = await self._session.execute(
            select(WorkItemDependency).where(
                WorkItemDependency.work_item_id == work_item_id
            )
        )
        return list(result.scalars().all())

    async def list_predecessors(self, work_item_id: UUID) -> list[WorkItem]:
        result = await self._session.execute(
            select(WorkItem)
            .join(
                WorkItemDependency,
                WorkItemDependency.depends_on_id == WorkItem.id,
            )
            .where(
                WorkItemDependency.work_item_id == work_item_id,
                WorkItem.deleted_at.is_(None),
            )
        )
        return list(result.scalars().all())

    async def list_dependency_edges(self, proyecto_id: UUID) -> list[tuple[UUID, UUID]]:
        result = await self._session.execute(
            select(
                WorkItemDependency.work_item_id,
                WorkItemDependency.depends_on_id,
            )
            .join(WorkItem, WorkItem.id == WorkItemDependency.work_item_id)
            .where(WorkItem.proyecto_id == proyecto_id)
        )
        return [(row[0], row[1]) for row in result.all()]
