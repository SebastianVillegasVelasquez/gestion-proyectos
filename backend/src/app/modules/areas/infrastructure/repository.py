"""Lectura del avance por área (cargo) dentro de un proyecto.

Read model transversal: agrupa las tareas del proyecto por el cargo del
responsable y cuenta asignadas/completadas en una sola consulta agrupada.
La tarea pertenece al proyecto vía su nodo o su fase (como en trazabilidad).
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import String, case, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.infrastructure.models import User
from app.modules.project.infrastructure.models import Project
from app.modules.project.structure.infrastructure.models import WorkItem
from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.tasks.infrastructure.models import Task


@dataclass
class AreaRow:
    """Una fila por cargo: cuántas personas y su avance de tareas."""

    position: str
    member_count: int
    assigned_tasks: int
    completed_tasks: int


class AreaRepository(ABC):
    @abstractmethod
    async def project_exists(self, project_id: UUID) -> bool: ...

    @abstractmethod
    async def area_rows(self, project_id: UUID) -> list[AreaRow]: ...


_STATUS = cast(Task.status, String)
_COMPLETED = TaskStatus.COMPLETADA.name


class SqlAlchemyAreaRepository(AreaRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def project_exists(self, project_id: UUID) -> bool:
        found = await self._session.scalar(
            select(Project.id).where(
                Project.id == project_id, Project.deleted_at.is_(None)
            )
        )
        return found is not None

    async def area_rows(self, project_id: UUID) -> list[AreaRow]:
        rows = (
            await self._session.execute(
                select(
                    User.position,
                    func.count(func.distinct(Task.assignee_id)).label("members"),
                    func.count(Task.id).label("assigned"),
                    func.coalesce(
                        func.sum(case((_STATUS == _COMPLETED, 1), else_=0)), 0
                    ).label("completed"),
                )
                .join(User, Task.assignee_id == User.id)
                .join(WorkItem, Task.work_item_id == WorkItem.id)
                .where(
                    Task.deleted_at.is_(None),
                    Task.assignee_id.isnot(None),
                    WorkItem.proyecto_id == project_id,
                )
                .group_by(User.position)
            )
        ).all()

        return [
            AreaRow(
                position=row.position,
                member_count=int(row.members or 0),
                assigned_tasks=int(row.assigned or 0),
                completed_tasks=int(row.completed or 0),
            )
            for row in rows
        ]
