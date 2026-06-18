import datetime
import uuid

from sqlalchemy import text

from app.modules.project.infrastructure.enums import NodeType, ProjectRole
from app.modules.project.infrastructure.models import (
    Phase,
    Project,
    ProjectMember,
    ProjectNode,
)
from app.modules.tasks.infrastructure.enums import TaskStatus


async def _seed(db_session, tasks: list[dict]) -> None:
    project = Project(
        id=uuid.uuid4(),
        name="Proyecto Dashboard",
        description="Seed para tests",
    )
    db_session.add(project)
    await db_session.flush()

    node = ProjectNode(
        id=uuid.uuid4(),
        name="Programa raíz",
        node_type=NodeType.PROGRAMA,
        project_id=project.id,
    )
    db_session.add(node)
    await db_session.flush()

    today = datetime.date.today()
    insert_stmt = text(
        """
        INSERT INTO tasks (id, title, status, node_id, start_date, due_date)
        VALUES (:id, :title, :status, :node_id, :start_date, :due_date)
        """
    )

    for t in tasks:
        await db_session.execute(
            insert_stmt,
            {
                "id": uuid.uuid4(),
                "title": t.get("title", "Task"),
                "status": t["status"].name,
                "node_id": node.id,
                "start_date": today,
                "due_date": t.get("due_date", today + datetime.timedelta(days=7)),
            },
        )

    await db_session.commit()


class TestDashboardSummaryRoute:
    async def test_should_require_authentication(self, client):
        response = await client.get("/api/v1/dashboard/summary")
        assert response.status_code in (401, 403)

    async def test_should_return_zeros_for_empty_db(self, client, admin_headers):
        response = await client.get("/api/v1/dashboard/summary", headers=admin_headers)

        assert response.status_code == 200
        body = response.json()
        assert body == {
            "active_projects": 0,
            "total_tasks": 0,
            "completed_tasks": 0,
            "in_review_tasks": 0,
            "overdue_tasks": 0,
        }

    async def test_should_count_tasks_by_status_and_overdue(
        self, client, admin_headers, db_session
    ):
        today = datetime.date.today()
        await _seed(
            db_session,
            tasks=[
                {"status": TaskStatus.COMPLETADA},
                {"status": TaskStatus.COMPLETADA},
                {"status": TaskStatus.EN_REVISION},
                {
                    "status": TaskStatus.EN_PROGRESO,
                    "due_date": today - datetime.timedelta(days=1),
                },
                {
                    "status": TaskStatus.PENDIENTE_POR_INICIAR,
                    "due_date": today - datetime.timedelta(days=5),
                },
                {
                    "status": TaskStatus.CANCELADA,
                    "due_date": today - datetime.timedelta(days=10),
                },
                {
                    "status": TaskStatus.COMPLETADA,
                    "due_date": today - datetime.timedelta(days=2),
                },
            ],
        )

        response = await client.get("/api/v1/dashboard/summary", headers=admin_headers)

        assert response.status_code == 200
        body = response.json()
        assert body["active_projects"] == 1
        assert body["total_tasks"] == 7
        assert body["completed_tasks"] == 3
        assert body["in_review_tasks"] == 1
        assert body["overdue_tasks"] == 2

    async def test_should_allow_user_role(self, client, member_headers, db_session):
        await _seed(db_session, tasks=[{"status": TaskStatus.EN_REVISION}])

        response = await client.get("/api/v1/dashboard/summary", headers=member_headers)

        assert response.status_code == 200
        body = response.json()
        assert body["active_projects"] == 1
        assert body["in_review_tasks"] == 1


async def _seed_panels(db_session, admin_user) -> Project:
    """Proyecto con fase, coordinador y tareas en varios estados/fechas."""
    project = Project(
        id=uuid.uuid4(),
        name="Proyecto Panels",
        client_name="Cliente OBJ",
    )
    db_session.add(project)
    await db_session.flush()

    phase = Phase(
        id=uuid.uuid4(), name="Producción", order_index=0, project_id=project.id
    )
    db_session.add(phase)
    db_session.add(
        ProjectMember(
            project_id=project.id,
            user_id=admin_user.id,
            project_role=ProjectRole.COORDINADOR,
        )
    )
    await db_session.flush()

    today = datetime.date.today()
    insert_stmt = text(
        """
        INSERT INTO tasks (id, title, status, phase_id, start_date, due_date)
        VALUES (:id, :title, :status, :phase_id, :start_date, :due_date)
        """
    )
    rows = [
        (
            "Vencida en progreso",
            TaskStatus.EN_PROGRESO,
            today - datetime.timedelta(days=3),
        ),
        ("Vence hoy", TaskStatus.EN_REVISION, today),
        (
            "Futura pendiente",
            TaskStatus.PENDIENTE_POR_INICIAR,
            today + datetime.timedelta(days=5),
        ),
        ("Completada", TaskStatus.COMPLETADA, today - datetime.timedelta(days=1)),
    ]
    for title, status, due in rows:
        await db_session.execute(
            insert_stmt,
            {
                "id": uuid.uuid4(),
                "title": title,
                "status": status.name,
                "phase_id": phase.id,
                "start_date": today - datetime.timedelta(days=10),
                "due_date": due,
            },
        )
    await db_session.commit()
    return project


class TestDashboardPanelsRoute:
    async def test_should_require_authentication(self, client):
        response = await client.get("/api/v1/dashboard/panels")
        assert response.status_code in (401, 403)

    async def test_should_return_empty_panels_for_empty_db(self, client, admin_headers):
        response = await client.get("/api/v1/dashboard/panels", headers=admin_headers)
        assert response.status_code == 200
        body = response.json()
        assert body == {"task_board": [], "projects": [], "upcoming_deadlines": []}

    async def test_should_return_panels_with_real_data(
        self, client, admin_headers, admin_user, db_session
    ):
        await _seed_panels(db_session, admin_user)

        response = await client.get("/api/v1/dashboard/panels", headers=admin_headers)
        assert response.status_code == 200
        body = response.json()

        # Tablero: estados en minúscula (value) y con nombre de proyecto resuelto.
        statuses = {t["status"] for t in body["task_board"]}
        assert "en_progreso" in statuses
        assert all(t["project_name"] == "Proyecto Panels" for t in body["task_board"])
        assert len(body["task_board"]) == 4  # todas menos ninguna cancelada

        # Próximos vencimientos: excluye completadas y van ordenados ascendente.
        deadlines = body["upcoming_deadlines"]
        titles = [d["title"] for d in deadlines]
        assert "Completada" not in titles
        due_dates = [d["due_date"] for d in deadlines]
        assert due_dates == sorted(due_dates)

        # Proyecto: coordinador, conteos, progreso y estado en riesgo (hay vencida).
        project = next(p for p in body["projects"] if p["name"] == "Proyecto Panels")
        assert project["coordinator"] == f"{admin_user.name} {admin_user.last_name}"
        assert project["tasks_total"] == 4
        assert project["tasks_completed"] == 1
        assert project["progress_pct"] == 25
        assert project["status"] == "at-risk"
        assert project["client_name"] == "Cliente OBJ"
