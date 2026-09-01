from uuid import UUID

from app.modules.dashboard.infrastructure.repository import DashboardRepository
from app.modules.dashboard.presentation.schemas import (
    ActivityItemResponse,
    DashboardPanelsResponse,
    DashboardSummaryResponse,
    DeadlineItemResponse,
    MyProjectProgressResponse,
    ProjectOverviewItemResponse,
    PublicProjectProgressResponse,
    PublicProjectScheduleResponse,
    PublicScheduleItemResponse,
    RecentActivityResponse,
    TaskBoardItemResponse,
)
from app.modules.traceability.domain.events import classify_event
from app.shared.exceptions import NotFoundError


def _panels_to_response(panels) -> DashboardPanelsResponse:
    """Mapea el agregado de paneles del repo al schema de respuesta."""
    return DashboardPanelsResponse(
        task_board=[
            TaskBoardItemResponse(
                id=item.id,
                title=item.title,
                status=item.status,
                project_name=item.project_name,
                project_id=item.project_id,
                due_date=item.due_date,
            )
            for item in panels.task_board
        ],
        projects=[
            ProjectOverviewItemResponse(
                id=item.id,
                name=item.name,
                client_name=item.client_name,
                coordinator=item.coordinator,
                tasks_total=item.tasks_total,
                tasks_completed=item.tasks_completed,
                progress_pct=item.progress_pct,
                status=item.status,
            )
            for item in panels.projects
        ],
        upcoming_deadlines=[
            DeadlineItemResponse(
                id=item.id,
                title=item.title,
                project_name=item.project_name,
                due_date=item.due_date,
            )
            for item in panels.upcoming_deadlines
        ],
    )


class GetDashboardSummaryUseCase:
    def __init__(self, repo: DashboardRepository) -> None:
        self._repo = repo

    async def execute(self) -> DashboardSummaryResponse:
        summary = await self._repo.get_summary()
        return DashboardSummaryResponse(
            active_projects=summary.active_projects,
            total_tasks=summary.total_tasks,
            completed_tasks=summary.completed_tasks,
            in_review_tasks=summary.in_review_tasks,
            overdue_tasks=summary.overdue_tasks,
        )


class GetDashboardPanelsUseCase:
    """Trae, en una sola transacción, los datos de los tres paneles del tablero.

    Toda la selección/orden/recorte ocurre en SQL (indexable y acotado), así el
    frontend recibe solo lo que pinta — no toda la tabla de tareas.
    """

    def __init__(self, repo: DashboardRepository) -> None:
        self._repo = repo

    async def execute(
        self,
        board_limit: int = 6,
        projects_limit: int = 8,
        deadlines_limit: int = 8,
    ) -> DashboardPanelsResponse:
        panels = await self._repo.get_panels(
            board_limit=board_limit,
            projects_limit=projects_limit,
            deadlines_limit=deadlines_limit,
        )
        return _panels_to_response(panels)


class GetRecentActivityUseCase:
    """Actividad reciente del sistema para el dashboard admin.

    Toma los últimos eventos del historial de tareas (todos los proyectos) y los
    clasifica con la misma regla del dominio de trazabilidad, para que la UI
    muestre "creó", "entregó", "aprobó", "devolvió"… en vez del cambio crudo.
    """

    def __init__(self, repo: DashboardRepository) -> None:
        self._repo = repo

    async def execute(
        self, limit: int = 10, project_id: UUID | None = None
    ) -> RecentActivityResponse:
        rows = await self._repo.get_recent_activity(limit, project_id)
        return RecentActivityResponse(
            items=[
                ActivityItemResponse(
                    id=row.id,
                    task_id=row.task_id,
                    task_title=row.task_title,
                    project_name=row.project_name,
                    actor_name=row.actor_name,
                    kind=classify_event(
                        action=row.action,
                        new_status=row.new_status,
                        due_date=row.due_date,
                        occurred_on=row.created_at,
                        actor_id=row.actor_id,
                        assignee_id=row.assignee_id,
                    ).kind,
                    created_at=row.created_at,
                )
                for row in rows
            ]
        )


class GetMyDashboardSummaryUseCase:
    """KPIs del dashboard acotados al usuario autenticado (rol User)."""

    def __init__(self, repo: DashboardRepository) -> None:
        self._repo = repo

    async def execute(self, user_id: UUID) -> DashboardSummaryResponse:
        summary = await self._repo.get_summary_for_user(user_id)
        return DashboardSummaryResponse(
            active_projects=summary.active_projects,
            total_tasks=summary.total_tasks,
            completed_tasks=summary.completed_tasks,
            in_review_tasks=summary.in_review_tasks,
            overdue_tasks=summary.overdue_tasks,
        )


class GetMyDashboardPanelsUseCase:
    """Paneles del dashboard acotados al usuario: sus tareas y sus proyectos."""

    def __init__(self, repo: DashboardRepository) -> None:
        self._repo = repo

    async def execute(
        self,
        user_id: UUID,
        board_limit: int = 6,
        projects_limit: int = 8,
        deadlines_limit: int = 8,
    ) -> DashboardPanelsResponse:
        panels = await self._repo.get_panels_for_user(
            user_id=user_id,
            board_limit=board_limit,
            projects_limit=projects_limit,
            deadlines_limit=deadlines_limit,
        )
        return _panels_to_response(panels)


class GetMyProjectProgressUseCase:
    """Progreso general de un proyecto en solo lectura, si el usuario es miembro."""

    def __init__(self, repo: DashboardRepository) -> None:
        self._repo = repo

    async def execute(
        self, user_id: UUID, project_id: UUID
    ) -> MyProjectProgressResponse:
        detail = await self._repo.get_project_progress_for_user(user_id, project_id)
        if detail is None:
            # 404 indistinto (no-miembro o inexistente) para no filtrar qué proyectos existen.
            raise NotFoundError("Proyecto no encontrado")
        return MyProjectProgressResponse(
            id=detail.id,
            name=detail.name,
            client_name=detail.client_name,
            coordinator=detail.coordinator,
            status=detail.status,
            tasks_total=detail.tasks_total,
            tasks_completed=detail.tasks_completed,
            tasks_in_review=detail.tasks_in_review,
            tasks_overdue=detail.tasks_overdue,
            tasks_pending=detail.tasks_pending,
            progress_pct=detail.progress_pct,
            my_tasks=[
                TaskBoardItemResponse(
                    id=item.id,
                    title=item.title,
                    status=item.status,
                    project_name=item.project_name,
                    due_date=item.due_date,
                )
                for item in detail.my_tasks
            ],
        )


class GetMyProjectsUseCase:
    """Lista completa de proyectos donde el usuario autenticado es miembro.

    Alimenta la pantalla "Mis proyectos" del rol User. Misma forma de item que
    el panel de proyectos del dashboard, pero sin recorte por cantidad.
    """

    def __init__(self, repo: DashboardRepository) -> None:
        self._repo = repo

    async def execute(self, user_id: UUID) -> list[ProjectOverviewItemResponse]:
        items = await self._repo.list_projects_for_user(user_id)
        return [
            ProjectOverviewItemResponse(
                id=item.id,
                name=item.name,
                client_name=item.client_name,
                coordinator=item.coordinator,
                tasks_total=item.tasks_total,
                tasks_completed=item.tasks_completed,
                progress_pct=item.progress_pct,
                status=item.status,
            )
            for item in items
        ]


class GetPublicProjectProgressUseCase:
    """Progreso público de un proyecto por token de cliente (sin autenticación)."""

    def __init__(self, repo: DashboardRepository) -> None:
        self._repo = repo

    async def execute(self, token: str) -> PublicProjectProgressResponse:
        detail = await self._repo.get_project_progress_by_token(token)
        if detail is None:
            # 404 indistinto: no revela si el token existió alguna vez.
            raise NotFoundError("Proyecto no encontrado")
        return PublicProjectProgressResponse(
            name=detail.name,
            client_name=detail.client_name,
            coordinator=detail.coordinator,
            status=detail.status,
            tasks_total=detail.tasks_total,
            tasks_completed=detail.tasks_completed,
            tasks_in_review=detail.tasks_in_review,
            tasks_overdue=detail.tasks_overdue,
            tasks_pending=detail.tasks_pending,
            progress_pct=detail.progress_pct,
        )


class GetPublicProjectScheduleUseCase:
    """Cronograma público de un proyecto por token de cliente (sin autenticación)."""

    def __init__(self, repo: DashboardRepository) -> None:
        self._repo = repo

    async def execute(self, token: str) -> PublicProjectScheduleResponse:
        schedule = await self._repo.get_project_schedule_by_token(token)
        if schedule is None:
            # 404 indistinto: no revela si el token existió alguna vez.
            raise NotFoundError("Proyecto no encontrado")
        return PublicProjectScheduleResponse(
            project_name=schedule.project_name,
            items=[
                PublicScheduleItemResponse(
                    key=item.key,
                    parent_key=item.parent_key,
                    name=item.name,
                    depth=item.depth,
                    order=item.order,
                    start_date=item.start_date,
                    due_date=item.due_date,
                    status=item.status,
                    progress_pct=item.progress_pct,
                )
                for item in schedule.items
            ],
        )
