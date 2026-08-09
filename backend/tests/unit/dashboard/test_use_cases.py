import datetime
import uuid

from app.modules.dashboard.application.use_cases import (
    GetDashboardSummaryUseCase,
    GetRecentActivityUseCase,
)
from app.modules.dashboard.infrastructure.repository import ActivityRow
from app.modules.dashboard.presentation.schemas import (
    DashboardSummaryResponse,
    RecentActivityResponse,
)
from app.modules.tasks.infrastructure.enums import HistoryAction, TaskStatus
from tests.fixtures.unit.dashboard import FakeDashboardRepository


def _activity_row(action: HistoryAction, new_status: TaskStatus | None) -> ActivityRow:
    now = datetime.datetime(2026, 8, 9, 12, 0, tzinfo=datetime.timezone.utc)
    return ActivityRow(
        id=uuid.uuid4(),
        task_id=uuid.uuid4(),
        task_title="Diseñar módulo",
        project_name="Proyecto Alfa",
        actor_name="Ana Pérez",
        action=action,
        new_status=new_status,
        due_date=None,
        created_at=now,
    )


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


class TestGetRecentActivityUseCase:
    async def test_should_map_and_classify_events(self, build_fake_dashboard_repo):
        summary = build_fake_dashboard_repo()._summary
        repo = FakeDashboardRepository(
            summary,
            activity=[
                _activity_row(HistoryAction.CREACION, None),
                _activity_row(HistoryAction.CAMBIO_ESTADO, TaskStatus.EN_REVISION),
                _activity_row(HistoryAction.CAMBIO_ESTADO, TaskStatus.COMPLETADA),
            ],
        )

        response = await GetRecentActivityUseCase(repo).execute(limit=10)

        assert isinstance(response, RecentActivityResponse)
        assert [item.kind for item in response.items] == [
            "creacion",
            "entrega",
            "aprobacion",
        ]
        assert response.items[0].task_title == "Diseñar módulo"
        assert response.items[0].project_name == "Proyecto Alfa"
        assert response.items[0].actor_name == "Ana Pérez"

    async def test_should_respect_limit(self):
        from app.modules.dashboard.infrastructure.repository import DashboardSummary

        repo = FakeDashboardRepository(
            DashboardSummary(0, 0, 0, 0, 0),
            activity=[_activity_row(HistoryAction.CREACION, None) for _ in range(5)],
        )

        response = await GetRecentActivityUseCase(repo).execute(limit=2)

        assert len(response.items) == 2

    async def test_should_return_empty_when_no_activity(
        self, build_fake_dashboard_repo
    ):
        repo = build_fake_dashboard_repo()
        response = await GetRecentActivityUseCase(repo).execute()
        assert response.items == []
