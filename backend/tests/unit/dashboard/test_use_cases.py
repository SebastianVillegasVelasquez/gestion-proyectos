import datetime
import uuid

from app.modules.dashboard.application.use_cases import (
    GetDashboardSummaryUseCase,
    GetMyTeamActivityUseCase,
    GetPublicProjectScheduleUseCase,
    GetRecentActivityUseCase,
)
from app.modules.dashboard.infrastructure.repository import (
    ActivityRow,
    DashboardSummary,
    ProjectSchedule,
    ScheduleItem,
)
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


class TestGetMyTeamActivityUseCase:
    """La actividad del dashboard del líder: mismo mapeo/clasificación que la
    global, acotada por el repositorio a los equipos que lidera."""

    async def test_should_map_and_classify_the_leads_team_events(self):
        repo = FakeDashboardRepository(
            DashboardSummary(0, 0, 0, 0, 0),
            activity=[
                _activity_row(HistoryAction.CREACION, None),
                _activity_row(HistoryAction.CAMBIO_ESTADO, TaskStatus.COMPLETADA),
            ],
        )

        response = await GetMyTeamActivityUseCase(repo).execute(uuid.uuid4(), limit=10)

        assert isinstance(response, RecentActivityResponse)
        assert [item.kind for item in response.items] == ["creacion", "aprobacion"]

    async def test_should_be_empty_when_the_user_leads_nothing(
        self, build_fake_dashboard_repo
    ):
        repo = build_fake_dashboard_repo()
        response = await GetMyTeamActivityUseCase(repo).execute(uuid.uuid4())
        assert response.items == []


class TestGetPublicProjectScheduleUseCase:
    async def test_should_pass_tipo_through_for_bar_colours(self):
        # El portal del cliente pinta cada barra con el color de su TIPO de
        # elemento (mismo que la Estructura): el caso de uso debe propagar
        # `tipo_id` / `tipo_nombre` / `es_dependencia_externa` sin tocarlos.
        schedule = ProjectSchedule(
            project_name="Diplomado",
            items=[
                ScheduleItem(
                    key="n0",
                    parent_key=None,
                    name="Módulo 1",
                    depth=0,
                    order=0,
                    start_date=datetime.date(2026, 7, 1),
                    due_date=datetime.date(2026, 7, 20),
                    status="en_progreso",
                    progress_pct=45,
                    tipo_id="tipo-modulo",
                    tipo_nombre="Módulo",
                    es_dependencia_externa=False,
                ),
                ScheduleItem(
                    key="n1",
                    parent_key="n0",
                    name="Proveedor externo",
                    depth=1,
                    order=1,
                    start_date=datetime.date(2026, 7, 2),
                    due_date=datetime.date(2026, 7, 10),
                    status="pendiente_por_iniciar",
                    progress_pct=0,
                    tipo_id="tipo-terceros",
                    tipo_nombre="Actividad de terceros",
                    es_dependencia_externa=True,
                ),
            ],
        )
        repo = FakeDashboardRepository(
            DashboardSummary(0, 0, 0, 0, 0), project_schedule=schedule
        )

        response = await GetPublicProjectScheduleUseCase(repo).execute("tok")

        assert [(i.tipo_nombre, i.es_dependencia_externa) for i in response.items] == [
            ("Módulo", False),
            ("Actividad de terceros", True),
        ]
        assert response.items[0].tipo_id == "tipo-modulo"
