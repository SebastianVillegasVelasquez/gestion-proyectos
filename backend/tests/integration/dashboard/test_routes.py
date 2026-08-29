import datetime
import uuid

from sqlalchemy import text

from app.modules.project.infrastructure.enums import ProjectRole
from app.modules.project.infrastructure.models import Project, ProjectMember
from app.modules.project.structure.infrastructure.models import TipoNodo, WorkItem
from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.teams.infrastructure.enums import TeamRole
from app.modules.teams.infrastructure.models import Team, TeamMember


async def _make_work_item(db_session, project_id, nombre="Programa"):
    tipo = TipoNodo(id=uuid.uuid4(), proyecto_id=project_id, nombre=nombre)
    db_session.add(tipo)
    await db_session.flush()
    item = WorkItem(
        id=uuid.uuid4(),
        proyecto_id=project_id,
        tipo_id=tipo.id,
        nombre=nombre,
        orden=0,
    )
    db_session.add(item)
    await db_session.flush()
    return item


async def _seed(db_session, tasks: list[dict]) -> None:
    project = Project(
        id=uuid.uuid4(),
        name="Proyecto Dashboard",
        description="Seed para tests",
    )
    db_session.add(project)
    await db_session.flush()
    item = await _make_work_item(db_session, project.id)

    today = datetime.date.today()
    insert_stmt = text(
        """
        INSERT INTO tasks (id, title, status, project_id, work_item_id, start_date, due_date)
        VALUES (:id, :title, :status, :project_id, :work_item_id, :start_date, :due_date)
        """
    )
    for t in tasks:
        await db_session.execute(
            insert_stmt,
            {
                "id": uuid.uuid4(),
                "title": t.get("title", "Task"),
                "status": t["status"].name,
                "project_id": project.id,
                "work_item_id": item.id,
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
        body = response.json()
        assert body["active_projects"] == 1
        assert body["total_tasks"] == 7
        assert body["completed_tasks"] == 3
        assert body["in_review_tasks"] == 1
        assert body["overdue_tasks"] == 2


async def _seed_panels(db_session, admin_user) -> Project:
    """Proyecto con un work_item, coordinador y tareas en varios estados/fechas."""
    project = Project(
        id=uuid.uuid4(), name="Proyecto Panels", client_name="Cliente OBJ"
    )
    db_session.add(project)
    await db_session.flush()

    item = await _make_work_item(db_session, project.id, nombre="Producción")
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
        INSERT INTO tasks (id, title, status, project_id, work_item_id, start_date, due_date)
        VALUES (:id, :title, :status, :project_id, :work_item_id, :start_date, :due_date)
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
                "project_id": project.id,
                "work_item_id": item.id,
                "start_date": today - datetime.timedelta(days=10),
                "due_date": due,
            },
        )
    await db_session.commit()
    return project


class TestDashboardPanelsRoute:
    async def test_should_return_empty_panels_for_empty_db(self, client, admin_headers):
        response = await client.get("/api/v1/dashboard/panels", headers=admin_headers)
        assert response.status_code == 200
        assert response.json() == {
            "task_board": [],
            "projects": [],
            "upcoming_deadlines": [],
        }

    async def test_should_return_panels_with_real_data(
        self, client, admin_headers, admin_user, db_session
    ):
        await _seed_panels(db_session, admin_user)
        response = await client.get("/api/v1/dashboard/panels", headers=admin_headers)
        body = response.json()

        statuses = {t["status"] for t in body["task_board"]}
        assert "en_progreso" in statuses
        assert all(t["project_name"] == "Proyecto Panels" for t in body["task_board"])
        assert len(body["task_board"]) == 4

        titles = [d["title"] for d in body["upcoming_deadlines"]]
        assert "Completada" not in titles
        dues = [d["due_date"] for d in body["upcoming_deadlines"]]
        assert dues == sorted(dues)

        project = next(p for p in body["projects"] if p["name"] == "Proyecto Panels")
        assert project["coordinator"] == f"{admin_user.name} {admin_user.last_name}"
        assert project["tasks_total"] == 4
        assert project["tasks_completed"] == 1
        assert project["progress_pct"] == 25
        assert project["status"] == "at-risk"
        assert project["client_name"] == "Cliente OBJ"


async def _insert_task(
    db_session, project_id, work_item_id, title, status, due, assignee_id=None
):
    today = datetime.date.today()
    await db_session.execute(
        text(
            """
            INSERT INTO tasks
                (id, title, status, project_id, work_item_id, start_date, due_date, assignee_id)
            VALUES
                (:id, :title, :status, :project_id, :work_item_id, :start_date, :due_date, :assignee_id)
            """
        ),
        {
            "id": uuid.uuid4(),
            "title": title,
            "status": status.name,
            "project_id": project_id,
            "work_item_id": work_item_id,
            "start_date": today,
            "due_date": due,
            "assignee_id": assignee_id,
        },
    )


async def _seed_user_scope(db_session, member, other):
    """Proyecto A: `member` es integrante. Proyecto B: no lo es."""
    today = datetime.date.today()

    project_a = Project(id=uuid.uuid4(), name="Proyecto A", client_name="Cliente A")
    project_b = Project(id=uuid.uuid4(), name="Proyecto B", client_name="Cliente B")
    db_session.add_all([project_a, project_b])
    await db_session.flush()
    item_a = await _make_work_item(db_session, project_a.id, nombre="Fase A")
    item_b = await _make_work_item(db_session, project_b.id, nombre="Fase B")

    db_session.add(
        ProjectMember(
            project_id=project_a.id,
            user_id=member.id,
            project_role=ProjectRole.INTEGRANTE,
        )
    )
    await db_session.flush()

    # Proyecto A: 2 tareas del member + 1 de "other" (progreso general = 3 tareas).
    await _insert_task(
        db_session,
        project_a.id,
        item_a.id,
        "Mía completada",
        TaskStatus.COMPLETADA,
        today,
        member.id,
    )
    await _insert_task(
        db_session,
        project_a.id,
        item_a.id,
        "Mía vencida",
        TaskStatus.EN_PROGRESO,
        today - datetime.timedelta(days=2),
        member.id,
    )
    await _insert_task(
        db_session,
        project_a.id,
        item_a.id,
        "De otro",
        TaskStatus.PENDIENTE_POR_INICIAR,
        today,
        other.id,
    )
    # Proyecto B: tarea de "other"; el member no debe verla.
    await _insert_task(
        db_session,
        project_b.id,
        item_b.id,
        "Ajena",
        TaskStatus.EN_PROGRESO,
        today,
        other.id,
    )
    await db_session.commit()
    return project_a, project_b


class TestMyDashboardRoutes:
    async def test_me_summary_requires_auth(self, client):
        response = await client.get("/api/v1/dashboard/me/summary")
        assert response.status_code in (401, 403)

    async def test_me_summary_scopes_to_user(
        self, client, member_headers, member_user, admin_user, db_session
    ):
        await _seed_user_scope(db_session, member_user, admin_user)
        response = await client.get(
            "/api/v1/dashboard/me/summary", headers=member_headers
        )
        body = response.json()
        assert body["active_projects"] == 1  # solo Proyecto A
        assert body["total_tasks"] == 2  # solo las tareas del member
        assert body["completed_tasks"] == 1
        assert body["overdue_tasks"] == 1

    async def test_me_panels_only_my_projects_and_tasks(
        self, client, member_headers, member_user, admin_user, db_session
    ):
        await _seed_user_scope(db_session, member_user, admin_user)
        response = await client.get(
            "/api/v1/dashboard/me/panels", headers=member_headers
        )
        body = response.json()
        assert [p["name"] for p in body["projects"]] == ["Proyecto A"]
        # Progreso general del proyecto = 3 tareas (no solo las del member).
        assert body["projects"][0]["tasks_total"] == 3
        titles = {t["title"] for t in body["task_board"]}
        assert titles == {"Mía completada", "Mía vencida"}

    async def test_me_project_progress_member_ok(
        self, client, member_headers, member_user, admin_user, db_session
    ):
        project_a, _ = await _seed_user_scope(db_session, member_user, admin_user)
        response = await client.get(
            f"/api/v1/dashboard/me/projects/{project_a.id}", headers=member_headers
        )
        assert response.status_code == 200
        body = response.json()
        assert body["tasks_total"] == 3  # progreso general
        assert body["tasks_completed"] == 1
        assert {t["title"] for t in body["my_tasks"]} == {
            "Mía completada",
            "Mía vencida",
        }

    async def test_me_project_progress_non_member_is_404(
        self, client, member_headers, member_user, admin_user, db_session
    ):
        _, project_b = await _seed_user_scope(db_session, member_user, admin_user)
        response = await client.get(
            f"/api/v1/dashboard/me/projects/{project_b.id}", headers=member_headers
        )
        assert response.status_code == 404

    async def test_me_project_progress_includes_tasks_without_due_date(
        self, client, member_headers, member_user, admin_user, db_session
    ):
        """Regresión: una tarea propia sin fecha límite rompía la serialización
        (`due_date` era obligatorio) y devolvía 500 en producción. Ahora la tarea
        aparece con `due_date` nulo en vez de ocultarse o tumbar la vista."""
        project_a, _ = await _seed_user_scope(db_session, member_user, admin_user)
        item = await _make_work_item(db_session, project_a.id, nombre="Sin fechas")
        await _insert_task(
            db_session,
            project_a.id,
            item.id,
            "Mía sin fecha",
            TaskStatus.EN_PROGRESO,
            None,
            member_user.id,
        )
        await db_session.commit()

        response = await client.get(
            f"/api/v1/dashboard/me/projects/{project_a.id}", headers=member_headers
        )
        assert response.status_code == 200
        body = response.json()
        sin_fecha = next(t for t in body["my_tasks"] if t["title"] == "Mía sin fecha")
        assert sin_fecha["due_date"] is None

    async def test_me_panels_task_board_allows_tasks_without_due_date(
        self, client, member_headers, member_user, admin_user, db_session
    ):
        """El tablero del dashboard tampoco debe caerse por una tarea sin fecha."""
        project_a, _ = await _seed_user_scope(db_session, member_user, admin_user)
        item = await _make_work_item(db_session, project_a.id, nombre="Sin fechas")
        await _insert_task(
            db_session,
            project_a.id,
            item.id,
            "Tablero sin fecha",
            TaskStatus.PENDIENTE_POR_INICIAR,
            None,
            member_user.id,
        )
        await db_session.commit()

        response = await client.get(
            "/api/v1/dashboard/me/panels", headers=member_headers
        )
        assert response.status_code == 200
        body = response.json()
        board = {t["title"]: t for t in body["task_board"]}
        assert board["Tablero sin fecha"]["due_date"] is None
        # Un vencimiento necesita fecha: la tarea sin fecha no entra ahí.
        assert "Tablero sin fecha" not in {
            d["title"] for d in body["upcoming_deadlines"]
        }

    async def test_me_panels_upcoming_deadlines_window(
        self, client, member_headers, member_user, admin_user, db_session
    ):
        """ "Próximos vencimientos" del rol User = lo atrasado + lo que vence en
        los próximos 7 días. Fuera de esa ventana, cerrado o sin fecha: no entra."""
        project_a, _ = await _seed_user_scope(db_session, member_user, admin_user)
        item = await _make_work_item(db_session, project_a.id, nombre="Ventana")
        today = datetime.date.today()
        casos = [
            ("Atrasada", TaskStatus.EN_PROGRESO, today - datetime.timedelta(days=3)),
            (
                "En 3 días",
                TaskStatus.PENDIENTE_POR_INICIAR,
                today + datetime.timedelta(days=3),
            ),
            ("En 6 días", TaskStatus.EN_PROGRESO, today + datetime.timedelta(days=6)),
            (
                "En 20 días",
                TaskStatus.PENDIENTE_POR_INICIAR,
                today + datetime.timedelta(days=20),
            ),
            (
                "Cerrada pronto",
                TaskStatus.COMPLETADA,
                today + datetime.timedelta(days=2),
            ),
            ("Sin fecha", TaskStatus.EN_PROGRESO, None),
        ]
        for titulo, estado, due in casos:
            await _insert_task(
                db_session, project_a.id, item.id, titulo, estado, due, member_user.id
            )
        await db_session.commit()

        response = await client.get(
            "/api/v1/dashboard/me/panels", headers=member_headers
        )
        assert response.status_code == 200
        titulos = [d["title"] for d in response.json()["upcoming_deadlines"]]
        # Solo lo abierto, con fecha y dentro de la ventana; ordenado por fecha asc
        # ("Mía vencida" viene del seed base: today-2, también dentro de la ventana).
        assert titulos == ["Atrasada", "Mía vencida", "En 3 días", "En 6 días"]

    async def test_indirect_team_member_sees_project(
        self, client, member_headers, member_user, admin_user, db_session
    ):
        """Acceso vía equipo: el usuario está en un equipo del Proyecto B pero NO
        en `project_members`. Aun así el proyecto aparece en su dashboard y la
        vista de progreso abre (antes daba 404). Simula una fila heredada: el
        `TeamMember` se crea por ORM porque el endpoint ya no lo permitiría."""
        _, project_b = await _seed_user_scope(db_session, member_user, admin_user)
        team = Team(id=uuid.uuid4(), project_id=project_b.id, name="Equipo B")
        db_session.add(team)
        await db_session.flush()
        db_session.add(
            TeamMember(
                team_id=team.id,
                user_id=member_user.id,
                team_role=TeamRole.INTEGRANTE,
            )
        )
        await db_session.commit()

        listado = await client.get(
            "/api/v1/dashboard/me/projects", headers=member_headers
        )
        assert listado.status_code == 200
        assert "Proyecto B" in {p["name"] for p in listado.json()}

        progreso = await client.get(
            f"/api/v1/dashboard/me/projects/{project_b.id}", headers=member_headers
        )
        assert progreso.status_code == 200

        resumen = await client.get(
            "/api/v1/dashboard/me/summary", headers=member_headers
        )
        # Proyecto A (miembro directo) + Proyecto B (vía equipo).
        assert resumen.json()["active_projects"] == 2
