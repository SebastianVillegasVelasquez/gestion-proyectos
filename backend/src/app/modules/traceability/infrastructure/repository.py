"""Lectura del historial de trazabilidad de un proyecto.

Read model transversal: une `TaskHistory` con la tarea y con el proyecto (vía
el nodo o la fase a la que cuelga la tarea), más el autor del cambio. Solo lee y
devuelve dataclasses; la clasificación de eventos vive en el dominio.
"""

import datetime
from abc import ABC, abstractmethod
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.infrastructure.models import User
from app.modules.project.infrastructure.models import Project
from app.modules.project.structure.infrastructure.models import WorkItem
from app.modules.tasks.infrastructure.enums import HistoryAction, TaskStatus
from app.modules.tasks.infrastructure.models import Task, TaskHistory

# Tope de eventos que trae la línea de tiempo. Acota el trabajo de la BD y el
# tamaño del payload; el resumen se calcula sobre lo traído (los más recientes).
MAX_EVENTS = 300


@dataclass
class TraceabilityEventRow:
    id: UUID
    task_id: UUID
    task_title: str
    actor_name: str | None
    action: HistoryAction
    old_status: TaskStatus | None
    new_status: TaskStatus | None
    change_reason: str | None
    due_date: datetime.date | None
    created_at: datetime.datetime


class TraceabilityRepository(ABC):
    @abstractmethod
    async def project_exists(self, project_id: UUID) -> bool: ...

    @abstractmethod
    async def list_events(self, project_id: UUID) -> list[TraceabilityEventRow]: ...


class SqlAlchemyTraceabilityRepository(TraceabilityRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def project_exists(self, project_id: UUID) -> bool:
        found = await self._session.scalar(
            select(Project.id).where(
                Project.id == project_id, Project.deleted_at.is_(None)
            )
        )
        return found is not None

    async def list_events(self, project_id: UUID) -> list[TraceabilityEventRow]:
        # La tarea cuelga del árbol flexible (WorkItem), que ya conoce su proyecto.
        rows = (
            await self._session.execute(
                select(
                    TaskHistory,
                    Task.title,
                    Task.due_date,
                    User.name,
                    User.last_name,
                )
                .join(Task, TaskHistory.task_id == Task.id)
                .join(WorkItem, Task.work_item_id == WorkItem.id)
                .outerjoin(User, TaskHistory.changed_by_id == User.id)
                .where(
                    Task.deleted_at.is_(None),
                    WorkItem.proyecto_id == project_id,
                )
                .order_by(TaskHistory.created_at.desc())
                .limit(MAX_EVENTS)
            )
        ).all()

        events: list[TraceabilityEventRow] = []
        for hist, title, due_date, name, last_name in rows:
            actor_name = f"{name} {last_name}".strip() if name else None
            events.append(
                TraceabilityEventRow(
                    id=hist.id,
                    task_id=hist.task_id,
                    task_title=title,
                    actor_name=actor_name,
                    action=hist.action,
                    old_status=hist.old_status,
                    new_status=hist.new_status,
                    change_reason=hist.change_reason,
                    due_date=due_date,
                    created_at=hist.created_at,
                )
            )
        return events
