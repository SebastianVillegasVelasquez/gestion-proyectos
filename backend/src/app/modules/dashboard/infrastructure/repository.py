import datetime
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from sqlalchemy import String, and_, case, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.infrastructure.models import User
from app.modules.project.infrastructure.enums import ProjectRole
from app.modules.project.infrastructure.models import Project, ProjectMember
from app.modules.project.structure.infrastructure.models import WorkItem
from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.tasks.infrastructure.models import Task


@dataclass
class DashboardSummary:
    active_projects: int
    total_tasks: int
    completed_tasks: int
    in_review_tasks: int
    overdue_tasks: int


@dataclass
class TaskBoardItem:
    id: uuid.UUID
    title: str
    status: str  # value del enum (minúscula), tal cual lo espera el frontend
    project_name: str | None
    due_date: datetime.date


@dataclass
class ProjectOverviewItem:
    id: uuid.UUID
    name: str
    client_name: str | None
    coordinator: str | None
    tasks_total: int
    tasks_completed: int
    progress_pct: int
    status: str  # active | at-risk | in-review


@dataclass
class DeadlineItem:
    id: uuid.UUID
    title: str
    project_name: str | None
    due_date: datetime.date


@dataclass
class DashboardPanels:
    task_board: list[TaskBoardItem] = field(default_factory=list)
    projects: list[ProjectOverviewItem] = field(default_factory=list)
    upcoming_deadlines: list[DeadlineItem] = field(default_factory=list)


@dataclass
class ProjectProgressDetail:
    """Progreso general de un proyecto + las tareas propias del usuario en él.

    Vista de solo lectura para el rol User. El progreso se calcula sobre TODAS
    las tareas del proyecto (progreso general); `my_tasks` son solo las del usuario.
    """

    id: uuid.UUID
    name: str
    client_name: str | None
    coordinator: str | None
    status: str  # active | at-risk | in-review
    tasks_total: int
    tasks_completed: int
    tasks_in_review: int
    tasks_overdue: int
    tasks_pending: int
    progress_pct: int
    my_tasks: list[TaskBoardItem] = field(default_factory=list)


# Estados (se guardan por NAME en la BD; comparamos como string para no forzar
# a Postgres a castear parámetros al tipo enum, que en algunos entornos es VARCHAR).
_COMPLETED = TaskStatus.COMPLETADA.name
_IN_REVIEW = TaskStatus.EN_REVISION.name
_CANCELLED = TaskStatus.CANCELADA.name
_OPEN_EXCLUDED = [_COMPLETED, _CANCELLED]

# Buckets del tablero -> qué estados (NAME) entran en cada columna del frontend.
_PENDING_NAMES = [TaskStatus.PENDIENTE_POR_INICIAR.name, TaskStatus.DEVUELTA.name]
_IN_PROGRESS_NAMES = [TaskStatus.EN_PROGRESO.name, TaskStatus.EN_REVISION.name]
_COMPLETED_NAMES = [TaskStatus.COMPLETADA.name]


def _status_value(raw) -> str:
    """Devuelve el VALUE del enum (minúscula) a partir de lo que entregue la BD,
    que puede ser un miembro del enum o el NAME en texto."""
    if isinstance(raw, TaskStatus):
        return raw.value
    try:
        return TaskStatus[raw].value  # raw es el NAME ("EN_PROGRESO")
    except KeyError:
        try:
            return TaskStatus(raw).value  # raw ya es el VALUE
        except ValueError:
            return str(raw)


class DashboardRepository(ABC):
    @abstractmethod
    async def get_summary(self) -> DashboardSummary: ...

    @abstractmethod
    async def get_panels(
        self, board_limit: int, projects_limit: int, deadlines_limit: int
    ) -> DashboardPanels: ...

    # ── Variantes por usuario (dashboard del rol User) ──
    @abstractmethod
    async def get_summary_for_user(self, user_id: uuid.UUID) -> DashboardSummary: ...

    @abstractmethod
    async def get_panels_for_user(
        self,
        user_id: uuid.UUID,
        board_limit: int,
        projects_limit: int,
        deadlines_limit: int,
    ) -> DashboardPanels: ...

    @abstractmethod
    async def get_project_progress_for_user(
        self, user_id: uuid.UUID, project_id: uuid.UUID
    ) -> ProjectProgressDetail | None: ...


class SqlAlchemyDashboardRepository(DashboardRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ── KPIs ──────────────────────────────────────────────────────────────────
    async def get_summary(self) -> DashboardSummary:
        today = datetime.date.today()
        status_str = cast(Task.status, String)

        tasks_query = select(
            func.count(Task.id).label("total"),
            func.coalesce(
                func.sum(case((status_str == _COMPLETED, 1), else_=0)), 0
            ).label("completed"),
            func.coalesce(
                func.sum(case((status_str == _IN_REVIEW, 1), else_=0)), 0
            ).label("in_review"),
            func.coalesce(
                func.sum(
                    case(
                        (
                            and_(
                                Task.due_date < today,
                                status_str.notin_(_OPEN_EXCLUDED),
                            ),
                            1,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("overdue"),
        ).where(Task.deleted_at.is_(None))

        projects_query = select(func.count(Project.id)).where(
            Project.deleted_at.is_(None)
        )

        task_row = (await self._session.execute(tasks_query)).one()
        projects_count = (await self._session.execute(projects_query)).scalar_one()

        return DashboardSummary(
            active_projects=int(projects_count or 0),
            total_tasks=int(task_row.total or 0),
            completed_tasks=int(task_row.completed or 0),
            in_review_tasks=int(task_row.in_review or 0),
            overdue_tasks=int(task_row.overdue or 0),
        )

    # ── Paneles (tablero, proyectos, próximos vencimientos) ───────────────────
    async def get_panels(
        self, board_limit: int, projects_limit: int, deadlines_limit: int
    ) -> DashboardPanels:
        return DashboardPanels(
            task_board=await self._get_task_board(board_limit),
            projects=await self._get_projects_overview(projects_limit),
            upcoming_deadlines=await self._get_upcoming_deadlines(deadlines_limit),
        )

    def _task_with_project(self):
        """Cada tarea con el nombre de su proyecto, vía el WorkItem del que cuelga."""
        return (
            select(Task, Project.name.label("project_name"))
            .select_from(Task)
            .join(WorkItem, Task.work_item_id == WorkItem.id)
            .join(Project, WorkItem.proyecto_id == Project.id)
            .where(Task.deleted_at.is_(None))
        )

    async def _get_task_board(
        self, limit: int, assignee_id: uuid.UUID | None = None
    ) -> list[TaskBoardItem]:
        status_str = cast(Task.status, String)
        base = self._task_with_project()
        if assignee_id is not None:
            base = base.where(Task.assignee_id == assignee_id)

        items: list[TaskBoardItem] = []
        # Pendientes y en progreso: lo más urgente primero (fecha de fin asc).
        for names, order in (
            (_PENDING_NAMES, Task.due_date.asc()),
            (_IN_PROGRESS_NAMES, Task.due_date.asc()),
            # Completadas: las más recientes primero.
            (_COMPLETED_NAMES, Task.completed_at.desc().nullslast()),
        ):
            rows = (
                await self._session.execute(
                    base.where(status_str.in_(names)).order_by(order).limit(limit)
                )
            ).all()
            for task, project_name in rows:
                items.append(
                    TaskBoardItem(
                        id=task.id,
                        title=task.title,
                        status=_status_value(task.status),
                        project_name=project_name,
                        due_date=task.due_date,
                    )
                )
        return items

    async def _get_upcoming_deadlines(
        self, limit: int, assignee_id: uuid.UUID | None = None
    ) -> list[DeadlineItem]:
        status_str = cast(Task.status, String)
        base = self._task_with_project()
        if assignee_id is not None:
            base = base.where(Task.assignee_id == assignee_id)
        rows = (
            await self._session.execute(
                base.where(status_str.notin_(_OPEN_EXCLUDED))
                .order_by(Task.due_date.asc())
                .limit(limit)
            )
        ).all()
        return [
            DeadlineItem(
                id=task.id,
                title=task.title,
                project_name=project_name,
                due_date=task.due_date,
            )
            for task, project_name in rows
        ]

    async def _get_projects_overview(
        self, limit: int, project_ids=None
    ) -> list[ProjectOverviewItem]:
        today = datetime.date.today()
        status_str = cast(Task.status, String)

        # Conteos de tareas por proyecto (total, completadas, vencidas, en revisión).
        counts = (
            select(
                WorkItem.proyecto_id.label("pid"),
                func.count(Task.id).label("total"),
                func.coalesce(
                    func.sum(case((status_str == _COMPLETED, 1), else_=0)), 0
                ).label("completed"),
                func.coalesce(
                    func.sum(
                        case(
                            (
                                and_(
                                    Task.due_date < today,
                                    status_str.notin_(_OPEN_EXCLUDED),
                                ),
                                1,
                            ),
                            else_=0,
                        )
                    ),
                    0,
                ).label("overdue"),
                func.coalesce(
                    func.sum(case((status_str == _IN_REVIEW, 1), else_=0)), 0
                ).label("in_review"),
            )
            .select_from(Task)
            .join(WorkItem, Task.work_item_id == WorkItem.id)
            .where(Task.deleted_at.is_(None))
            .group_by(WorkItem.proyecto_id)
            .subquery()
        )

        # Coordinador del proyecto (el ProjectMember con rol COORDINADOR).
        coord = (
            select(
                ProjectMember.project_id.label("project_id"),
                func.min(func.concat(User.name, " ", User.last_name)).label(
                    "coordinator"
                ),
            )
            .select_from(ProjectMember)
            .join(User, User.id == ProjectMember.user_id)
            .where(
                cast(ProjectMember.project_role, String) == ProjectRole.COORDINADOR.name
            )
            .group_by(ProjectMember.project_id)
            .subquery()
        )

        query = (
            select(
                Project.id,
                Project.name,
                Project.client_name,
                func.coalesce(counts.c.total, 0).label("total"),
                func.coalesce(counts.c.completed, 0).label("completed"),
                func.coalesce(counts.c.overdue, 0).label("overdue"),
                func.coalesce(counts.c.in_review, 0).label("in_review"),
                coord.c.coordinator,
            )
            .select_from(Project)
            .outerjoin(counts, counts.c.pid == Project.id)
            .outerjoin(coord, coord.c.project_id == Project.id)
            .where(Project.deleted_at.is_(None))
            # Surfacing primero los proyectos con más tareas vencidas (en riesgo).
            .order_by(func.coalesce(counts.c.overdue, 0).desc(), Project.name.asc())
            .limit(limit)
        )

        # Dashboard del User: restringir a los proyectos donde es miembro.
        if project_ids is not None:
            query = query.where(Project.id.in_(project_ids))

        rows = (await self._session.execute(query)).all()
        items: list[ProjectOverviewItem] = []
        for row in rows:
            total = int(row.total or 0)
            completed = int(row.completed or 0)
            overdue = int(row.overdue or 0)
            in_review = int(row.in_review or 0)
            progress = round(completed / total * 100) if total else 0
            if overdue > 0:
                status = "at-risk"
            elif in_review > 0:
                status = "in-review"
            else:
                status = "active"
            items.append(
                ProjectOverviewItem(
                    id=row.id,
                    name=row.name,
                    client_name=row.client_name,
                    coordinator=row.coordinator,
                    tasks_total=total,
                    tasks_completed=completed,
                    progress_pct=progress,
                    status=status,
                )
            )
        return items

    # ── Variantes por usuario (rol User) ──────────────────────────────────────
    def _member_project_ids(self, user_id: uuid.UUID):
        """Subconsulta con los IDs de proyectos donde el usuario es miembro."""
        return select(ProjectMember.project_id).where(
            ProjectMember.user_id == user_id,
            ProjectMember.deleted_at.is_(None),
        )

    @staticmethod
    def _derive_status(overdue: int, in_review: int) -> str:
        if overdue > 0:
            return "at-risk"
        if in_review > 0:
            return "in-review"
        return "active"

    async def get_summary_for_user(self, user_id: uuid.UUID) -> DashboardSummary:
        today = datetime.date.today()
        status_str = cast(Task.status, String)

        tasks_query = select(
            func.count(Task.id).label("total"),
            func.coalesce(
                func.sum(case((status_str == _COMPLETED, 1), else_=0)), 0
            ).label("completed"),
            func.coalesce(
                func.sum(case((status_str == _IN_REVIEW, 1), else_=0)), 0
            ).label("in_review"),
            func.coalesce(
                func.sum(
                    case(
                        (
                            and_(
                                Task.due_date < today,
                                status_str.notin_(_OPEN_EXCLUDED),
                            ),
                            1,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("overdue"),
        ).where(Task.deleted_at.is_(None), Task.assignee_id == user_id)

        # Proyectos activos = proyectos (no borrados) donde el usuario es miembro.
        projects_query = (
            select(func.count(func.distinct(ProjectMember.project_id)))
            .select_from(ProjectMember)
            .join(Project, Project.id == ProjectMember.project_id)
            .where(
                ProjectMember.user_id == user_id,
                ProjectMember.deleted_at.is_(None),
                Project.deleted_at.is_(None),
            )
        )

        task_row = (await self._session.execute(tasks_query)).one()
        projects_count = (await self._session.execute(projects_query)).scalar_one()

        return DashboardSummary(
            active_projects=int(projects_count or 0),
            total_tasks=int(task_row.total or 0),
            completed_tasks=int(task_row.completed or 0),
            in_review_tasks=int(task_row.in_review or 0),
            overdue_tasks=int(task_row.overdue or 0),
        )

    async def get_panels_for_user(
        self,
        user_id: uuid.UUID,
        board_limit: int,
        projects_limit: int,
        deadlines_limit: int,
    ) -> DashboardPanels:
        return DashboardPanels(
            task_board=await self._get_task_board(board_limit, assignee_id=user_id),
            projects=await self._get_projects_overview(
                projects_limit, project_ids=self._member_project_ids(user_id)
            ),
            upcoming_deadlines=await self._get_upcoming_deadlines(
                deadlines_limit, assignee_id=user_id
            ),
        )

    async def get_project_progress_for_user(
        self, user_id: uuid.UUID, project_id: uuid.UUID
    ) -> ProjectProgressDetail | None:
        # Guard de membresía: si el usuario no pertenece al proyecto -> None (404).
        is_member = (
            await self._session.execute(
                select(ProjectMember.id)
                .where(
                    ProjectMember.project_id == project_id,
                    ProjectMember.user_id == user_id,
                    ProjectMember.deleted_at.is_(None),
                )
                .limit(1)
            )
        ).first()
        if is_member is None:
            return None

        project = (
            await self._session.execute(
                select(Project).where(
                    Project.id == project_id, Project.deleted_at.is_(None)
                )
            )
        ).scalar_one_or_none()
        if project is None:
            return None

        today = datetime.date.today()
        status_str = cast(Task.status, String)
        counts = (
            await self._session.execute(
                select(
                    func.count(Task.id).label("total"),
                    func.coalesce(
                        func.sum(case((status_str == _COMPLETED, 1), else_=0)), 0
                    ).label("completed"),
                    func.coalesce(
                        func.sum(case((status_str == _IN_REVIEW, 1), else_=0)), 0
                    ).label("in_review"),
                    func.coalesce(
                        func.sum(
                            case(
                                (
                                    and_(
                                        Task.due_date < today,
                                        status_str.notin_(_OPEN_EXCLUDED),
                                    ),
                                    1,
                                ),
                                else_=0,
                            )
                        ),
                        0,
                    ).label("overdue"),
                    func.coalesce(
                        func.sum(case((status_str.in_(_PENDING_NAMES), 1), else_=0)), 0
                    ).label("pending"),
                )
                .select_from(Task)
                .join(WorkItem, Task.work_item_id == WorkItem.id)
                .where(WorkItem.proyecto_id == project_id, Task.deleted_at.is_(None))
            )
        ).one()

        coordinator = (
            await self._session.execute(
                select(func.min(func.concat(User.name, " ", User.last_name)))
                .select_from(ProjectMember)
                .join(User, User.id == ProjectMember.user_id)
                .where(
                    ProjectMember.project_id == project_id,
                    cast(ProjectMember.project_role, String)
                    == ProjectRole.COORDINADOR.name,
                )
            )
        ).scalar()

        my_tasks_rows = (
            await self._session.execute(
                self._task_with_project()
                .where(
                    Task.assignee_id == user_id,
                    WorkItem.proyecto_id == project_id,
                )
                .order_by(Task.due_date.asc())
            )
        ).all()
        my_tasks = [
            TaskBoardItem(
                id=task.id,
                title=task.title,
                status=_status_value(task.status),
                project_name=project_name,
                due_date=task.due_date,
            )
            for task, project_name in my_tasks_rows
        ]

        total = int(counts.total or 0)
        completed = int(counts.completed or 0)
        in_review = int(counts.in_review or 0)
        overdue = int(counts.overdue or 0)
        pending = int(counts.pending or 0)
        progress = round(completed / total * 100) if total else 0

        return ProjectProgressDetail(
            id=project.id,
            name=project.name,
            client_name=project.client_name,
            coordinator=coordinator,
            status=self._derive_status(overdue, in_review),
            tasks_total=total,
            tasks_completed=completed,
            tasks_in_review=in_review,
            tasks_overdue=overdue,
            tasks_pending=pending,
            progress_pct=progress,
            my_tasks=my_tasks,
        )
