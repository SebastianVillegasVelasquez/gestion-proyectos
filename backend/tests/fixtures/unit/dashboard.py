import uuid

import pytest

from app.modules.dashboard.infrastructure.repository import (
    ActivityRow,
    DashboardPanels,
    DashboardRepository,
    DashboardSummary,
    ProjectProgressDetail,
    ProjectSchedule,
)


class FakeDashboardRepository(DashboardRepository):
    def __init__(
        self,
        summary: DashboardSummary,
        panels: DashboardPanels | None = None,
        project_progress: ProjectProgressDetail | None = None,
        project_schedule: ProjectSchedule | None = None,
        activity: list[ActivityRow] | None = None,
    ) -> None:
        self._summary = summary
        self._panels = panels or DashboardPanels()
        self._project_progress = project_progress
        self._project_schedule = project_schedule
        self._activity = activity or []

    async def get_summary(self) -> DashboardSummary:
        return self._summary

    async def get_panels(
        self, board_limit: int, projects_limit: int, deadlines_limit: int
    ) -> DashboardPanels:
        return self._panels

    async def get_recent_activity(self, limit: int) -> list[ActivityRow]:
        return self._activity[:limit]

    # Variantes por usuario: el fake ignora el user_id y devuelve lo configurado.
    async def get_summary_for_user(self, user_id: uuid.UUID) -> DashboardSummary:
        return self._summary

    async def get_panels_for_user(
        self,
        user_id: uuid.UUID,
        board_limit: int,
        projects_limit: int,
        deadlines_limit: int,
    ) -> DashboardPanels:
        return self._panels

    async def get_project_progress_for_user(
        self, user_id: uuid.UUID, project_id: uuid.UUID
    ) -> ProjectProgressDetail | None:
        return self._project_progress

    async def get_project_progress_by_token(
        self, token: str
    ) -> ProjectProgressDetail | None:
        return self._project_progress

    async def get_project_schedule_by_token(self, token: str) -> ProjectSchedule | None:
        return self._project_schedule


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
