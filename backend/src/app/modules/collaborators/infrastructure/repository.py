"""Lectura agregada de la actividad de los colaboradores.

Es un *read model* transversal (como el de dashboard): consulta tablas de
varios módulos (usuarios, tareas, historial, miembros de proyecto y de equipo)
solo para leer y agregar. No muta nada y devuelve dataclasses simples para que
la capa de aplicación las traduzca a DTOs.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from uuid import UUID

from sqlalchemy import String, cast, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.infrastructure.models import User
from app.modules.project.infrastructure.models import ProjectMember
from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.tasks.infrastructure.models import Task, TaskHistory
from app.modules.teams.infrastructure.models import TeamMember

# Cuántos elementos detallados traemos en la pantalla de actividad. Acota el
# trabajo de la BD y el payload (la lista/historial completos no aportan a una
# vista de resumen).
MAX_DETAIL_TASKS = 50
MAX_HISTORY_ENTRIES = 50


@dataclass
class CollaboratorRow:
    """Fila de la tabla de colaboradores con sus contadores de tareas."""

    user_id: UUID
    name: str
    last_name: str
    position: str
    assigned_tasks: int
    completed_tasks: int


@dataclass
class CollaboratorTaskRow:
    id: UUID
    title: str
    status: TaskStatus
    due_date: object  # datetime.date
    completed_at: object | None  # datetime | None


@dataclass
class CollaboratorHistoryRow:
    id: UUID
    task_id: UUID
    task_title: str
    action: object  # HistoryAction
    old_status: TaskStatus | None
    new_status: TaskStatus | None
    change_reason: str | None
    created_at: object  # datetime


@dataclass
class CollaboratorActivity:
    user_id: UUID
    name: str
    last_name: str
    email: str
    position: str
    assigned_tasks: int
    completed_tasks: int
    in_progress_tasks: int
    project_count: int
    team_count: int
    tasks: list[CollaboratorTaskRow] = field(default_factory=list)
    history: list[CollaboratorHistoryRow] = field(default_factory=list)


class CollaboratorRepository(ABC):
    @abstractmethod
    async def list_collaborators(
        self, search: str | None, limit: int, offset: int
    ) -> tuple[list[CollaboratorRow], int]: ...

    @abstractmethod
    async def get_activity(self, user_id: UUID) -> CollaboratorActivity | None: ...


# Comparamos el estado como texto contra el NOMBRE del enum (p. ej. "COMPLETADA"),
# igual que el módulo dashboard, para no depender de que exista el tipo enum de
# Postgres ni de cómo se serialice la columna.
_STATUS = cast(Task.status, String)
_COMPLETED = TaskStatus.COMPLETADA.name
_IN_PROGRESS = TaskStatus.EN_PROGRESO.name


class SqlAlchemyCollaboratorRepository(CollaboratorRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_collaborators(
        self, search: str | None, limit: int, offset: int
    ) -> tuple[list[CollaboratorRow], int]:
        # 1) Filtro base de usuarios (activos, no borrados) + búsqueda libre.
        conditions = [User.is_active.is_(True), User.deleted_at.is_(None)]
        if search:
            like = f"%{search.strip()}%"
            conditions.append(
                or_(
                    User.name.ilike(like),
                    User.last_name.ilike(like),
                    User.email.ilike(like),
                )
            )

        # 2) Total para la paginación (una sola consulta de conteo).
        total = await self._session.scalar(
            select(func.count()).select_from(User).where(*conditions)
        )

        # 3) Página de usuarios.
        users = (
            (
                await self._session.execute(
                    select(User)
                    .where(*conditions)
                    .order_by(User.name, User.last_name)
                    .limit(limit)
                    .offset(offset)
                )
            )
            .scalars()
            .all()
        )
        if not users:
            return [], int(total or 0)

        # 4) Contadores de tareas para SOLO los usuarios de la página, agregados
        #    en una única consulta agrupada (evita el problema N+1).
        user_ids = [u.id for u in users]
        counts_rows = (
            await self._session.execute(
                select(
                    Task.assignee_id,
                    func.count(Task.id).label("assigned"),
                    func.coalesce(
                        func.sum(case((_STATUS == _COMPLETED, 1), else_=0)), 0
                    ).label("completed"),
                )
                .where(Task.deleted_at.is_(None), Task.assignee_id.in_(user_ids))
                .group_by(Task.assignee_id)
            )
        ).all()
        counts = {row.assignee_id: row for row in counts_rows}

        rows = [
            CollaboratorRow(
                user_id=u.id,
                name=u.name,
                last_name=u.last_name,
                position=u.position,
                assigned_tasks=int(getattr(counts.get(u.id), "assigned", 0) or 0),
                completed_tasks=int(getattr(counts.get(u.id), "completed", 0) or 0),
            )
            for u in users
        ]
        return rows, int(total or 0)

    async def get_activity(self, user_id: UUID) -> CollaboratorActivity | None:
        user = await self._session.get(User, user_id)
        if user is None or user.is_deleted:
            return None

        # Contadores de tareas por estado en una sola consulta.
        counts_row = (
            await self._session.execute(
                select(
                    func.count(Task.id).label("assigned"),
                    func.coalesce(
                        func.sum(case((_STATUS == _COMPLETED, 1), else_=0)), 0
                    ).label("completed"),
                    func.coalesce(
                        func.sum(case((_STATUS == _IN_PROGRESS, 1), else_=0)), 0
                    ).label("in_progress"),
                ).where(Task.deleted_at.is_(None), Task.assignee_id == user_id)
            )
        ).one()

        project_count = await self._session.scalar(
            select(func.count(func.distinct(ProjectMember.project_id))).where(
                ProjectMember.user_id == user_id,
                ProjectMember.deleted_at.is_(None),
            )
        )
        team_count = await self._session.scalar(
            select(func.count(TeamMember.id)).where(TeamMember.user_id == user_id)
        )

        # Tareas asignadas (acotadas), por fecha de entrega más próxima.
        task_rows = (
            (
                await self._session.execute(
                    select(Task)
                    .where(Task.deleted_at.is_(None), Task.assignee_id == user_id)
                    .order_by(Task.due_date.asc())
                    .limit(MAX_DETAIL_TASKS)
                )
            )
            .scalars()
            .all()
        )
        tasks = [
            CollaboratorTaskRow(
                id=t.id,
                title=t.title,
                status=t.status,
                due_date=t.due_date,
                completed_at=t.completed_at,
            )
            for t in task_rows
        ]

        # Historial: cambios realizados por este usuario, con el título de la
        # tarea (un join, sin lazy loading en contexto async).
        history_rows = (
            await self._session.execute(
                select(TaskHistory, Task.title)
                .join(Task, TaskHistory.task_id == Task.id)
                .where(TaskHistory.changed_by_id == user_id)
                .order_by(TaskHistory.created_at.desc())
                .limit(MAX_HISTORY_ENTRIES)
            )
        ).all()
        history = [
            CollaboratorHistoryRow(
                id=h.id,
                task_id=h.task_id,
                task_title=title,
                action=h.action,
                old_status=h.old_status,
                new_status=h.new_status,
                change_reason=h.change_reason,
                created_at=h.created_at,
            )
            for h, title in history_rows
        ]

        return CollaboratorActivity(
            user_id=user.id,
            name=user.name,
            last_name=user.last_name,
            email=user.email,
            position=user.position,
            assigned_tasks=int(counts_row.assigned or 0),
            completed_tasks=int(counts_row.completed or 0),
            in_progress_tasks=int(counts_row.in_progress or 0),
            project_count=int(project_count or 0),
            team_count=int(team_count or 0),
            tasks=tasks,
            history=history,
        )
