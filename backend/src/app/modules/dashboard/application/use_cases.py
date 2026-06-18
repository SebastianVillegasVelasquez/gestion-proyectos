from app.modules.dashboard.infrastructure.repository import DashboardRepository
from app.modules.dashboard.presentation.schemas import (
    DashboardPanelsResponse,
    DashboardSummaryResponse,
    DeadlineItemResponse,
    ProjectOverviewItemResponse,
    TaskBoardItemResponse,
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
        return DashboardPanelsResponse(
            task_board=[
                TaskBoardItemResponse(
                    id=item.id,
                    title=item.title,
                    status=item.status,
                    project_name=item.project_name,
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
