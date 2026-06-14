import pytest

from app.modules.dashboard.infrastructure.repository import (
    DashboardRepository,
    DashboardSummary,
)


class FakeDashboardRepository(DashboardRepository):
    def __init__(self, summary: DashboardSummary) -> None:
        self._summary = summary

    async def get_summary(self) -> DashboardSummary:
        return self._summary


@pytest.fixture
def build_fake_dashboard_repo():
    def _make(
        active_projects: int = 0,
        total_tasks: int = 0,
        completed_tasks: int = 0,
        in_review_tasks: int = 0,
        overdue_tasks: int = 0,
    ) -> FakeDashboardRepository:
        return FakeDashboardRepository(
            DashboardSummary(
                active_projects=active_projects,
                total_tasks=total_tasks,
                completed_tasks=completed_tasks,
                in_review_tasks=in_review_tasks,
                overdue_tasks=overdue_tasks,
            )
        )

    return _make
