import datetime
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from sqlalchemy import ColumnElement, String, and_, case, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.infrastructure.models import User
from app.modules.project.infrastructure.enums import ProjectRole
from app.modules.project.infrastructure.models import Project, ProjectMember
from app.modules.project.structure.infrastructure.models import WorkItem
from app.modules.tasks.infrastructure.enums import HistoryAction, TaskStatus
from app.modules.tasks.infrastructure.models import Task, TaskHistory
from app.modules.teams.infrastructure.models import Team, TeamMember


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
    # Id del proyecto: la vista del usuario agrupa SUS tareas por proyecto y
    # enlaza a cada uno; con el nombre solo no se puede navegar.
    project_id: uuid.UUID | None
    # Puede faltar: una tarea recién creada aún no tiene fecha límite fijada. Se
    # muestra como "sin fecha", no se oculta (el negocio quiere ver la actividad).
    due_date: datetime.date | None


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
class ActivityRow:
    """Un evento del historial de tareas, transversal a todos los proyectos.

    Fila cruda del read model de actividad reciente del dashboard admin: qué
    pasó (action + new_status), sobre qué tarea/proyecto y quién lo hizo. La
    clasificación semántica (creación, entrega, devolución…) la hace el caso de
    uso reutilizando la regla del dominio de trazabilidad.
    """

    id: uuid.UUID
    task_id: uuid.UUID
    task_title: str
    project_name: str | None
    actor_name: str | None
    action: HistoryAction
    new_status: TaskStatus | None
    due_date: datetime.date | None
    created_at: datetime.datetime


@dataclass
class DashboardPanels:
    task_board: list[TaskBoardItem] = field(default_factory=list)
    projects: list[ProjectOverviewItem] = field(default_factory=list)
    upcoming_deadlines: list[DeadlineItem] = field(default_factory=list)


@dataclass
class ScheduleItem:
    """Fila del cronograma público: un ELEMENTO de la estructura con su tiempo.

    El portal del cliente muestra el flujo del proyecto por sus componentes o
    entregables, nunca las tareas individuales ni quién las ejecuta. Cada ítem
    lleva su rango agregado (de sus propias fechas plan, sus tareas y las de sus
    descendientes) y un avance derivado. `key`/`parent_key` son índices opacos
    (no UUIDs internos) que solo sirven para reconstruir la jerarquía en la UI.
    """

    key: str
    parent_key: str | None
    name: str
    depth: int
    order: int
    start_date: datetime.date
    due_date: datetime.date
    status: str  # value del enum de tareas (para el color de la barra)
    progress_pct: int
    # Distingue una fila de tarea (hoja) de un elemento de la estructura, para que
    # la UI las muestre con matiz distinto. Nunca se expone responsable ni equipo.
    is_task: bool = False


@dataclass
class ProjectSchedule:
    """Cronograma público de un proyecto: nombre + estructura fechada (sin tareas)."""

    project_name: str
    items: list[ScheduleItem] = field(default_factory=list)


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


# Estados como miembros del enum. Al comparar Task.status (la columna) contra el
# miembro, SQLAlchemy bindea al tipo `task_status` nativo SIN cast, por lo que el
# índice ix_tasks_status es utilizable (un cast a String lo inhabilitaría).
_COMPLETED = TaskStatus.COMPLETADA
_IN_REVIEW = TaskStatus.EN_REVISION
_CANCELLED = TaskStatus.CANCELADA
_OPEN_EXCLUDED = [_COMPLETED, _CANCELLED]

# Buckets del tablero -> qué estados entran en cada columna del frontend.
_PENDING = [TaskStatus.PENDIENTE_POR_INICIAR, TaskStatus.DEVUELTA]
_IN_PROGRESS = [TaskStatus.EN_PROGRESO, TaskStatus.EN_REVISION]
_COMPLETED_BUCKET = [TaskStatus.COMPLETADA]

# Avance derivado del estado de una tarea (no hay % por tarea en el modelo).
# Espejo de STATUS_PROGRESS del cronograma del frontend, para que la barra de una
# tarea en el portal del cliente comunique lo mismo que dentro del proyecto.
_TASK_STATUS_PROGRESS = {
    TaskStatus.PENDIENTE_POR_INICIAR: 0,
    TaskStatus.EN_PROGRESO: 35,
    TaskStatus.EN_REVISION: 70,
    TaskStatus.DEVUELTA: 50,
    TaskStatus.COMPLETADA: 100,
    TaskStatus.CANCELADA: 0,
}


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

    @abstractmethod
    async def get_recent_activity(
        self, limit: int, project_id: uuid.UUID | None = None
    ) -> list[ActivityRow]: ...

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

    @abstractmethod
    async def list_projects_for_user(
        self, user_id: uuid.UUID
    ) -> list[ProjectOverviewItem]: ...

    # ── Portal público del cliente (sin autenticación, por token) ──
    @abstractmethod
    async def get_project_progress_by_token(
        self, token: str
    ) -> ProjectProgressDetail | None: ...

    @abstractmethod
    async def get_project_schedule_by_token(
        self, token: str
    ) -> ProjectSchedule | None: ...


class SqlAlchemyDashboardRepository(DashboardRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ── KPIs ──────────────────────────────────────────────────────────────────
    async def get_summary(self) -> DashboardSummary:
        today = datetime.date.today()
        status_col = Task.status

        tasks_query = select(
            func.count(Task.id).label("total"),
            func.coalesce(
                func.sum(case((status_col == _COMPLETED, 1), else_=0)), 0
            ).label("completed"),
            func.coalesce(
                func.sum(case((status_col == _IN_REVIEW, 1), else_=0)), 0
            ).label("in_review"),
            func.coalesce(
                func.sum(
                    case(
                        (
                            and_(
                                Task.due_date < today,
                                status_col.notin_(_OPEN_EXCLUDED),
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

    # ── Actividad reciente (transversal a todos los proyectos) ────────────────
    async def get_recent_activity(
        self, limit: int, project_id: uuid.UUID | None = None
    ) -> list[ActivityRow]:
        """Últimos eventos del historial de tareas, de cualquier proyecto.

        Se une por `Task.project_id` (siempre presente) y no por el WorkItem, para
        no perder eventos de tareas aún sin ubicar en la estructura. Ordena por
        fecha descendente y acota a `limit`: la BD hace el trabajo, el payload es
        mínimo. Con `project_id` la misma consulta se restringe a un solo proyecto
        (para el detalle de proyecto), sin duplicar lógica.
        """
        conditions: list[ColumnElement[bool]] = [
            Task.deleted_at.is_(None),
            Project.deleted_at.is_(None),
        ]
        if project_id is not None:
            conditions.append(Task.project_id == project_id)
        rows = (
            await self._session.execute(
                select(
                    TaskHistory,
                    Task.title,
                    Task.due_date,
                    Project.name,
                    User.name,
                    User.last_name,
                )
                .join(Task, TaskHistory.task_id == Task.id)
                .join(Project, Task.project_id == Project.id)
                .outerjoin(User, TaskHistory.changed_by_id == User.id)
                .where(*conditions)
                .order_by(TaskHistory.created_at.desc())
                .limit(limit)
            )
        ).all()

        activity: list[ActivityRow] = []
        for hist, title, due_date, project_name, name, last_name in rows:
            actor_name = f"{name} {last_name}".strip() if name else None
            activity.append(
                ActivityRow(
                    id=hist.id,
                    task_id=hist.task_id,
                    task_title=title,
                    project_name=project_name,
                    actor_name=actor_name,
                    action=hist.action,
                    new_status=hist.new_status,
                    due_date=due_date,
                    created_at=hist.created_at,
                )
            )
        return activity

    def _task_with_project(self):
        """Cada tarea con el nombre de su proyecto, vía el WorkItem del que cuelga."""
        return (
            select(
                Task, Project.name.label("project_name"), Project.id.label("project_id")
            )
            .select_from(Task)
            .join(WorkItem, Task.work_item_id == WorkItem.id)
            .join(Project, WorkItem.proyecto_id == Project.id)
            .where(Task.deleted_at.is_(None))
        )

    async def _get_task_board(
        self, limit: int, assignee_id: uuid.UUID | None = None
    ) -> list[TaskBoardItem]:
        status_col = Task.status
        base = self._task_with_project()
        if assignee_id is not None:
            base = base.where(Task.assignee_id == assignee_id)

        items: list[TaskBoardItem] = []
        # Pendientes y en progreso: lo más urgente primero (fecha de fin asc).
        for names, order in (
            (_PENDING, Task.due_date.asc()),
            (_IN_PROGRESS, Task.due_date.asc()),
            # Completadas: las más recientes primero.
            (_COMPLETED_BUCKET, Task.completed_at.desc().nullslast()),
        ):
            rows = (
                await self._session.execute(
                    base.where(status_col.in_(names)).order_by(order).limit(limit)
                )
            ).all()
            for task, project_name, project_id in rows:
                items.append(
                    TaskBoardItem(
                        id=task.id,
                        title=task.title,
                        status=_status_value(task.status),
                        project_name=project_name,
                        project_id=project_id,
                        due_date=task.due_date,
                    )
                )
        return items

    async def _get_upcoming_deadlines(
        self,
        limit: int,
        assignee_id: uuid.UUID | None = None,
        horizon_days: int | None = None,
    ) -> list[DeadlineItem]:
        """Tareas abiertas ordenadas por fecha límite más próxima.

        Un "vencimiento" necesita fecha: las tareas sin `due_date` no entran aquí
        (sí se ven en el tablero y en "mis tareas por proyecto", como "sin fecha").

        Con `horizon_days` se acota a lo que vence de aquí a N días. Lo ya vencido
        queda incluido: su fecha también está por debajo de ese tope, y a la
        persona le urge tanto o más que lo que vence pronto.
        """
        status_col = Task.status
        base = self._task_with_project()
        if assignee_id is not None:
            base = base.where(Task.assignee_id == assignee_id)
        conditions: list[ColumnElement[bool]] = [
            status_col.notin_(_OPEN_EXCLUDED),
            Task.due_date.is_not(None),
        ]
        if horizon_days is not None:
            horizon = datetime.date.today() + datetime.timedelta(days=horizon_days)
            conditions.append(Task.due_date <= horizon)
        rows = (
            await self._session.execute(
                base.where(*conditions).order_by(Task.due_date.asc()).limit(limit)
            )
        ).all()
        return [
            DeadlineItem(
                id=task.id,
                title=task.title,
                project_name=project_name,
                due_date=task.due_date,
            )
            for task, project_name, _project_id in rows
        ]

    async def _get_projects_overview(
        self, limit: int, project_ids=None
    ) -> list[ProjectOverviewItem]:
        today = datetime.date.today()
        status_col = Task.status

        # Conteos de tareas por proyecto (total, completadas, vencidas, en revisión).
        counts = (
            select(
                WorkItem.proyecto_id.label("pid"),
                func.count(Task.id).label("total"),
                func.coalesce(
                    func.sum(case((status_col == _COMPLETED, 1), else_=0)), 0
                ).label("completed"),
                func.coalesce(
                    func.sum(
                        case(
                            (
                                and_(
                                    Task.due_date < today,
                                    status_col.notin_(_OPEN_EXCLUDED),
                                ),
                                1,
                            ),
                            else_=0,
                        )
                    ),
                    0,
                ).label("overdue"),
                func.coalesce(
                    func.sum(case((status_col == _IN_REVIEW, 1), else_=0)), 0
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
    def _accessible_project_ids(self, user_id: uuid.UUID):
        """IDs de proyectos que el usuario puede ver en su dashboard.

        Dos vías: miembro directo (`project_members`) o integrante de alguno de
        sus equipos, ya que un equipo vive dentro de un proyecto
        (`team_members` -> `teams.project_id`). El acceso vía equipo es de solo
        lectura: aparece en el dashboard y abre la vista de progreso, pero no
        otorga permisos de gestión (esos siguen mirando `project_members`).

        `UNION` deduplica, así que un proyecto al que se llega por ambas vías
        cuenta una sola vez.
        """
        direct = select(ProjectMember.project_id).where(
            ProjectMember.user_id == user_id,
            ProjectMember.deleted_at.is_(None),
        )
        via_team = (
            select(Team.project_id)
            .join(TeamMember, TeamMember.team_id == Team.id)
            .where(
                TeamMember.user_id == user_id,
                Team.deleted_at.is_(None),
            )
        )
        return direct.union(via_team)

    @staticmethod
    def _derive_status(overdue: int, in_review: int) -> str:
        if overdue > 0:
            return "at-risk"
        if in_review > 0:
            return "in-review"
        return "active"

    async def get_summary_for_user(self, user_id: uuid.UUID) -> DashboardSummary:
        today = datetime.date.today()
        status_col = Task.status

        tasks_query = select(
            func.count(Task.id).label("total"),
            func.coalesce(
                func.sum(case((status_col == _COMPLETED, 1), else_=0)), 0
            ).label("completed"),
            func.coalesce(
                func.sum(case((status_col == _IN_REVIEW, 1), else_=0)), 0
            ).label("in_review"),
            func.coalesce(
                func.sum(
                    case(
                        (
                            and_(
                                Task.due_date < today,
                                status_col.notin_(_OPEN_EXCLUDED),
                            ),
                            1,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("overdue"),
        ).where(Task.deleted_at.is_(None), Task.assignee_id == user_id)

        # Proyectos activos = proyectos (no borrados) a los que el usuario tiene
        # acceso, sea como miembro directo o vía equipo.
        accessible = self._accessible_project_ids(user_id).subquery()
        projects_query = (
            select(func.count())
            .select_from(accessible)
            .join(Project, Project.id == accessible.c.project_id)
            .where(Project.deleted_at.is_(None))
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

    # Ventana de "Próximos vencimientos" del rol User: lo que vence en la próxima
    # semana (más lo ya atrasado). Cae 1 o varios proyectos según qué entre.
    _USER_DEADLINE_HORIZON_DAYS = 7

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
                projects_limit, project_ids=self._accessible_project_ids(user_id)
            ),
            upcoming_deadlines=await self._get_upcoming_deadlines(
                deadlines_limit,
                assignee_id=user_id,
                horizon_days=self._USER_DEADLINE_HORIZON_DAYS,
            ),
        )

    async def list_projects_for_user(
        self, user_id: uuid.UUID
    ) -> list[ProjectOverviewItem]:
        """Todos los proyectos donde el usuario es miembro (sin recorte).

        Reusa `_get_projects_overview` acotándolo por membresía. A diferencia del
        panel del dashboard (que muestra unos pocos), esta es la lista completa
        que alimenta la pantalla "Mis proyectos" del rol User.
        """
        return await self._get_projects_overview(
            limit=1000, project_ids=self._accessible_project_ids(user_id)
        )

    async def _project_counts(self, project_id: uuid.UUID):
        """Conteo de tareas de un proyecto por estado (total/completadas/…).

        Extraído para compartirlo entre el progreso del miembro y el del portal
        público del cliente: una sola consulta, una sola fuente de verdad (DRY).
        """
        today = datetime.date.today()
        status_col = Task.status
        return (
            await self._session.execute(
                select(
                    func.count(Task.id).label("total"),
                    func.coalesce(
                        func.sum(case((status_col == _COMPLETED, 1), else_=0)), 0
                    ).label("completed"),
                    func.coalesce(
                        func.sum(case((status_col == _IN_REVIEW, 1), else_=0)), 0
                    ).label("in_review"),
                    func.coalesce(
                        func.sum(
                            case(
                                (
                                    and_(
                                        Task.due_date < today,
                                        status_col.notin_(_OPEN_EXCLUDED),
                                    ),
                                    1,
                                ),
                                else_=0,
                            )
                        ),
                        0,
                    ).label("overdue"),
                    func.coalesce(
                        func.sum(case((status_col.in_(_PENDING), 1), else_=0)), 0
                    ).label("pending"),
                )
                .select_from(Task)
                .join(WorkItem, Task.work_item_id == WorkItem.id)
                .where(WorkItem.proyecto_id == project_id, Task.deleted_at.is_(None))
            )
        ).one()

    async def _project_coordinator(self, project_id: uuid.UUID) -> str | None:
        return (
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

    def _build_progress(
        self, project, counts, coordinator: str | None, my_tasks: list[TaskBoardItem]
    ) -> ProjectProgressDetail:
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

    async def get_project_progress_for_user(
        self, user_id: uuid.UUID, project_id: uuid.UUID
    ) -> ProjectProgressDetail | None:
        # Guard de acceso: miembro directo del proyecto o integrante de uno de sus
        # equipos. Si no tiene ninguna vía -> None (el endpoint responde 404
        # indistinto, sin revelar si el proyecto existe).
        accessible = self._accessible_project_ids(user_id).subquery()
        has_access = (
            await self._session.execute(
                select(accessible.c.project_id)
                .where(accessible.c.project_id == project_id)
                .limit(1)
            )
        ).first()
        if has_access is None:
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

        counts = await self._project_counts(project_id)
        coordinator = await self._project_coordinator(project_id)

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
                project_id=row_project_id,
                due_date=task.due_date,
            )
            for task, project_name, row_project_id in my_tasks_rows
        ]

        return self._build_progress(project, counts, coordinator, my_tasks)

    async def _project_by_token(self, token: str) -> Project | None:
        """Proyecto activo cuyo token de cliente coincide, o None.

        Fuente única de la traducción token → proyecto para todo el portal
        público (progreso y cronograma comparten esta puerta de entrada).
        """
        return (
            await self._session.execute(
                select(Project).where(
                    Project.client_access_token == token,
                    Project.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()

    async def get_project_progress_by_token(
        self, token: str
    ) -> ProjectProgressDetail | None:
        """Progreso público de un proyecto por su token de cliente (sin login).

        No expone `my_tasks` (no hay usuario): el cliente ve solo el avance
        agregado. Devuelve None si el token no corresponde a ningún proyecto
        activo (el endpoint lo traduce a 404, sin revelar si el token existió).
        """
        project = await self._project_by_token(token)
        if project is None:
            return None

        counts = await self._project_counts(project.id)
        coordinator = await self._project_coordinator(project.id)
        return self._build_progress(project, counts, coordinator, my_tasks=[])

    async def get_project_schedule_by_token(self, token: str) -> ProjectSchedule | None:
        """Cronograma público de un proyecto por su token de cliente (sin login).

        Muestra la ESTRUCTURA del proyecto (sus componentes/entregables) con su
        tiempo, no las tareas: cada fila es un elemento del árbol y su barra abarca
        el rango agregado de sus propias fechas plan, sus tareas y las de sus
        descendientes. Así el cliente ve el flujo del proyecto por sus componentes,
        con su avance derivado, sin exponer tareas individuales ni quién las ejecuta.
        Devuelve None si el token no corresponde a ningún proyecto activo.
        """
        project = await self._project_by_token(token)
        if project is None:
            return None

        # Elementos de la estructura del proyecto: jerarquía + fechas plan.
        work_items = (
            (
                await self._session.execute(
                    select(WorkItem).where(
                        WorkItem.proyecto_id == project.id,
                        WorkItem.deleted_at.is_(None),
                    )
                )
            )
            .scalars()
            .all()
        )

        # Hijos por padre, ordenados por `orden` (igual que el árbol del frontend).
        children: dict[uuid.UUID | None, list[WorkItem]] = {}
        for wi in work_items:
            children.setdefault(wi.parent_id, []).append(wi)
        for siblings in children.values():
            siblings.sort(key=lambda w: (w.orden, str(w.id)))

        # Tareas del proyecto agrupadas por elemento. Las fechadas aportan al rango;
        # todas (fechadas o no) cuentan para el avance completadas/total.
        task_rows = (
            (
                await self._session.execute(
                    select(Task)
                    .join(WorkItem, Task.work_item_id == WorkItem.id)
                    .where(
                        WorkItem.proyecto_id == project.id,
                        Task.deleted_at.is_(None),
                    )
                )
            )
            .scalars()
            .all()
        )
        tasks_by_item: dict[uuid.UUID, list[Task]] = {}
        for task in task_rows:
            if task.work_item_id is not None:
                tasks_by_item.setdefault(task.work_item_id, []).append(task)

        # Agregado de subárbol (memoizado): fechas para el rango + conteos de avance.
        subtree_cache: dict[
            uuid.UUID, tuple[list[datetime.date], list[datetime.date], int, int]
        ] = {}

        def subtree(node: WorkItem):
            cached = subtree_cache.get(node.id)
            if cached is not None:
                return cached
            starts: list[datetime.date] = []
            ends: list[datetime.date] = []
            total = 0
            completed = 0
            if node.fecha_inicio_plan is not None:
                starts.append(node.fecha_inicio_plan)
            if node.fecha_fin_plan is not None:
                ends.append(node.fecha_fin_plan)
            for task in tasks_by_item.get(node.id, []):
                total += 1
                if task.status == _COMPLETED:
                    completed += 1
                if task.start_date is not None and task.due_date is not None:
                    starts.append(task.start_date)
                    ends.append(task.due_date)
            for child in children.get(node.id, []):
                c_starts, c_ends, c_total, c_completed = subtree(child)
                starts += c_starts
                ends += c_ends
                total += c_total
                completed += c_completed
            result = (starts, ends, total, completed)
            subtree_cache[node.id] = result
            return result

        def derive_status(progress: int) -> str:
            if progress >= 100:
                return TaskStatus.COMPLETADA.value
            if progress > 0:
                return TaskStatus.EN_PROGRESO.value
            return TaskStatus.PENDIENTE_POR_INICIAR.value

        items: list[ScheduleItem] = []
        counter = 0

        # DFS: un elemento sin rango resoluble no dibuja barra, pero sus hijos sí
        # pueden tenerlo; en ese caso se reasignan al ancestro incluido más cercano
        # para que la jerarquía quede consistente.
        def walk(node: WorkItem, parent_key: str | None, depth: int) -> None:
            nonlocal counter
            starts, ends, total, completed = subtree(node)
            child_parent = parent_key
            child_depth = depth
            if starts and ends:
                if total > 0:
                    progress = round(completed / total * 100)
                elif node.porcentaje_completado is not None:
                    progress = round(float(node.porcentaje_completado) * 100)
                else:
                    progress = 0
                key = f"n{counter}"
                counter += 1
                items.append(
                    ScheduleItem(
                        key=key,
                        parent_key=parent_key,
                        name=node.nombre,
                        depth=depth,
                        order=len(items),
                        start_date=min(starts),
                        due_date=max(ends),
                        status=derive_status(progress),
                        progress_pct=progress,
                    )
                )
                child_parent = key
                child_depth = depth + 1

                # Tareas fechadas del elemento como filas hijas (hojas). El cliente
                # ve la tarea, su plazo y su estado, pero NUNCA el responsable ni el
                # equipo. Las sin fechas no dibujan barra, así que se omiten.
                dated_tasks: list[tuple[datetime.date, datetime.date, Task]] = [
                    (t.start_date, t.due_date, t)
                    for t in tasks_by_item.get(node.id, [])
                    if t.start_date is not None and t.due_date is not None
                ]
                dated_tasks.sort(key=lambda row: (row[0], row[2].title))
                for start_date, due_date, task in dated_tasks:
                    task_status = (
                        task.status
                        if isinstance(task.status, TaskStatus)
                        else TaskStatus(task.status)
                    )
                    items.append(
                        ScheduleItem(
                            key=f"n{counter}",
                            parent_key=key,
                            name=task.title,
                            depth=child_depth,
                            order=len(items),
                            start_date=start_date,
                            due_date=due_date,
                            status=task_status.value,
                            progress_pct=_TASK_STATUS_PROGRESS.get(task_status, 0),
                            is_task=True,
                        )
                    )
                    counter += 1
            for child in children.get(node.id, []):
                walk(child, child_parent, child_depth)

        for root in children.get(None, []):
            walk(root, None, 0)

        return ProjectSchedule(project_name=project.name, items=items)
