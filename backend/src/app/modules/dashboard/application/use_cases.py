from app.modules.dashboard.infrastructure.repository import DashboardRepository
from app.modules.dashboard.presentation.schemas import DashboardSummaryResponse


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
