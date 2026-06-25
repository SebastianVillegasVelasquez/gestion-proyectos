from app.modules.dashboard.application.use_cases import GetDashboardSummaryUseCase
from app.modules.dashboard.presentation.schemas import DashboardSummaryResponse


class TestGetDashboardSummaryUseCase:
    async def test_should_return_summary_from_repository(
        self, build_fake_dashboard_repo
    ):
        repo = build_fake_dashboard_repo(
            active_projects=5,
            total_tasks=40,
            completed_tasks=18,
            in_review_tasks=7,
            overdue_tasks=3,
        )

        use_case = GetDashboardSummaryUseCase(repo)
        response = await use_case.execute()

        assert isinstance(response, DashboardSummaryResponse)
        assert response.active_projects == 5
        assert response.total_tasks == 40
        assert response.completed_tasks == 18
        assert response.in_review_tasks == 7
        assert response.overdue_tasks == 3

    async def test_should_return_zeros_when_empty(self, build_fake_dashboard_repo):
        use_case = GetDashboardSummaryUseCase(build_fake_dashboard_repo())
        response = await use_case.execute()

        assert response.active_projects == 0
        assert response.total_tasks == 0
        assert response.completed_tasks == 0
        assert response.in_review_tasks == 0
        assert response.overdue_tasks == 0
