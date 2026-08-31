"""Lectura del historial de trazabilidad de un proyecto.

Read model transversal: une `TaskHistory` con su tarea, con quien hizo el
cambio y con el contexto que hace legible el evento (ubicación en la
estructura, equipo y responsable actuales de la tarea). Solo lee y devuelve
dataclasses; la clasificación de eventos vive en el dominio.
"""

import datetime
from abc import ABC, abstractmethod
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import aliased
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.infrastructure.models import User
from app.modules.project.infrastructure.models import Project
from app.modules.project.structure.infrastructure.models import WorkItem
from app.modules.tasks.infrastructure.enums import HistoryAction, TaskStatus
from app.modules.tasks.infrastructure.models import Task, TaskHistory
from app.modules.teams.infrastructure.models import Team

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
    # Ids crudos: dejan distinguir "el responsable cerró su tarea" (entrega
    # directa) de "un revisor la aprobó". No se exponen en la respuesta.
    actor_id: UUID | None = None
    assignee_id: UUID | None = None
    # Delta legible de los cambios que no son de estado. Con valor por defecto
    # porque la mayoría de eventos (los de estado) no lo llevan.
    old_value: str | None = None
    new_value: str | None = None
    # Contexto ACTUAL de la tarea (no el del momento del evento): sirve para
    # filtrar la línea de tiempo por equipo o ubicación desde el frontend.
    work_item_id: UUID | None = None
    work_item_name: str | None = None
    team_id: UUID | None = None
    team_name: str | None = None
    assignee_name: str | None = None


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
        # El filtro va por `Task.project_id`, que es NOT NULL desde que toda
        # tarea nace ligada a un proyecto. Antes se filtraba navegando hasta
        # `WorkItem` con un INNER JOIN, y eso dejaba fuera de la trazabilidad a
        # TODA tarea suelta (creada sin ubicación en la estructura) — que es
        # justo la forma en que se crea una tarea a mano.
        actor = aliased(User)
        assignee = aliased(User)
        rows = (
            await self._session.execute(
                select(
                    TaskHistory,
                    Task.title,
                    Task.due_date,
                    Task.work_item_id,
                    WorkItem.nombre,
                    Task.team_id,
                    Team.name,
                    actor.name,
                    actor.last_name,
                    assignee.name,
                    assignee.last_name,
                    Task.assignee_id,
                )
                .join(Task, TaskHistory.task_id == Task.id)
                # Todo lo demás es OUTER: la ubicación, el equipo y el
                # responsable son opcionales, y perder el evento por no tenerlos
                # es exactamente el bug que se está corrigiendo.
                .outerjoin(WorkItem, Task.work_item_id == WorkItem.id)
                .outerjoin(Team, Task.team_id == Team.id)
                .outerjoin(actor, TaskHistory.changed_by_id == actor.id)
                .outerjoin(assignee, Task.assignee_id == assignee.id)
                .where(
                    Task.deleted_at.is_(None),
                    Task.project_id == project_id,
                )
                .order_by(TaskHistory.created_at.desc())
                .limit(MAX_EVENTS)
            )
        ).all()

        def full_name(name: str | None, last_name: str | None) -> str | None:
            return f"{name} {last_name or ''}".strip() if name else None

        return [
            TraceabilityEventRow(
                id=hist.id,
                task_id=hist.task_id,
                task_title=title,
                actor_name=full_name(actor_name, actor_last),
                action=hist.action,
                old_status=hist.old_status,
                new_status=hist.new_status,
                change_reason=hist.change_reason,
                old_value=hist.old_value,
                new_value=hist.new_value,
                due_date=due_date,
                created_at=hist.created_at,
                work_item_id=work_item_id,
                work_item_name=work_item_name,
                team_id=team_id,
                team_name=team_name,
                assignee_name=full_name(assignee_name, assignee_last),
                actor_id=hist.changed_by_id,
                assignee_id=assignee_id,
            )
            for (
                hist,
                title,
                due_date,
                work_item_id,
                work_item_name,
                team_id,
                team_name,
                actor_name,
                actor_last,
                assignee_name,
                assignee_last,
                assignee_id,
            ) in rows
        ]
