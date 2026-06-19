import datetime
import uuid

import pytest_asyncio

from app.modules.project.infrastructure.enums import ProjectRole
from app.modules.project.infrastructure.models import Project, ProjectMember
from app.modules.project.structure.infrastructure.models import TipoNodo, WorkItem
from app.modules.tasks.infrastructure.enums import HistoryAction, TaskStatus
from app.modules.tasks.infrastructure.models import Task, TaskHistory

UTC = datetime.timezone.utc


def _dt(y, m, d):
    return datetime.datetime(y, m, d, tzinfo=UTC)


@pytest_asyncio.fixture
async def project_with_history(db_session):
    """Proyecto con una tarea y 5 eventos: creación, inicio, entrega (a revisión),
    devolución y un cambio tardío (retraso)."""
    project = Project(id=uuid.uuid4(), name="Proyecto Trazable", description="seed")
    db_session.add(project)
    await db_session.flush()

    tipo = TipoNodo(id=uuid.uuid4(), proyecto_id=project.id, nombre="Programa")
    db_session.add(tipo)
    await db_session.flush()
    node = WorkItem(
        id=uuid.uuid4(),
        proyecto_id=project.id,
        tipo_id=tipo.id,
        nombre="Programa",
        orden=0,
    )
    db_session.add(node)
    await db_session.flush()

    due = datetime.date(2026, 1, 20)
    task = Task(
        id=uuid.uuid4(),
        title="Guion Unidad 1",
        status=TaskStatus.EN_PROGRESO,
        work_item_id=node.id,
        start_date=datetime.date(2026, 1, 1),
        due_date=due,
    )
    db_session.add(task)
    await db_session.flush()

    events = [
        (HistoryAction.CREACION, None, None, _dt(2026, 1, 1)),
        (
            HistoryAction.CAMBIO_ESTADO,
            TaskStatus.PENDIENTE_POR_INICIAR,
            TaskStatus.EN_PROGRESO,
            _dt(2026, 1, 2),
        ),
        (
            HistoryAction.CAMBIO_ESTADO,
            TaskStatus.EN_PROGRESO,
            TaskStatus.EN_REVISION,
            _dt(2026, 1, 10),
        ),
        (
            HistoryAction.CAMBIO_ESTADO,
            TaskStatus.EN_REVISION,
            TaskStatus.DEVUELTA,
            _dt(2026, 1, 12),
        ),
        # Cambio tardío (después de la fecha límite) → retraso.
        (
            HistoryAction.CAMBIO_ESTADO,
            TaskStatus.DEVUELTA,
            TaskStatus.EN_PROGRESO,
            _dt(2026, 2, 1),
        ),
    ]
    for action, old, new, when in events:
        db_session.add(
            TaskHistory(
                id=uuid.uuid4(),
                task_id=task.id,
                action=action,
                old_status=old,
                new_status=new,
                created_at=when,
            )
        )

    await db_session.commit()
    return project


class TestProjectTraceabilityRoute:
    async def test_should_require_authentication(self, client, project_with_history):
        response = await client.get(
            f"/api/v1/projects/{project_with_history.id}/traceability"
        )
        assert response.status_code in (401, 403)

    async def test_admin_should_get_timeline_and_summary(
        self, client, admin_headers, project_with_history
    ):
        response = await client.get(
            f"/api/v1/projects/{project_with_history.id}/traceability",
            headers=admin_headers,
        )

        assert response.status_code == 200
        body = response.json()
        assert body["project_id"] == str(project_with_history.id)
        assert body["summary"]["total_events"] == 5
        assert body["summary"]["delays"] == 1
        assert body["summary"]["deliveries"] == 1  # la entrega a revisión
        assert body["summary"]["returns"] == 1

        # Orden descendente por fecha → el evento tardío (feb) va primero.
        first = body["events"][0]
        assert first["is_delay"] is True
        assert first["kind"] == "inicio"

    async def test_should_return_404_for_unknown_project(self, client, admin_headers):
        response = await client.get(
            f"/api/v1/projects/{uuid.uuid4()}/traceability", headers=admin_headers
        )
        assert response.status_code == 404

    async def test_should_forbid_non_member(
        self, client, member_headers, member_user, project_with_history
    ):
        # member_user no pertenece al proyecto → 403.
        response = await client.get(
            f"/api/v1/projects/{project_with_history.id}/traceability",
            headers=member_headers,
        )
        assert response.status_code == 403

    async def test_should_allow_project_coordinator(
        self, client, member_headers, member_user, project_with_history, db_session
    ):
        db_session.add(
            ProjectMember(
                id=uuid.uuid4(),
                project_id=project_with_history.id,
                user_id=member_user.id,
                project_role=ProjectRole.COORDINADOR,
            )
        )
        await db_session.commit()

        response = await client.get(
            f"/api/v1/projects/{project_with_history.id}/traceability",
            headers=member_headers,
        )
        assert response.status_code == 200
