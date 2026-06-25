import datetime
import uuid

import pytest_asyncio

from app.core.security import hash_password
from app.modules.identity.infrastructure.enums import UserPosition
from app.modules.identity.infrastructure.models import SystemRole, User
from app.modules.project.infrastructure.enums import ProjectRole
from app.modules.project.infrastructure.models import Project, ProjectMember
from app.modules.project.structure.infrastructure.models import TipoNodo, WorkItem
from app.modules.tasks.infrastructure.enums import HistoryAction, TaskStatus
from app.modules.tasks.infrastructure.models import Task, TaskHistory
from app.modules.teams.infrastructure.enums import TeamRole
from app.modules.teams.infrastructure.models import Team, TeamMember


@pytest_asyncio.fixture
async def collaborator(db_session):
    """Usuario con 4 tareas (1 completada, 1 en progreso), en 1 proyecto y 1
    equipo, con una entrada de historial."""
    user = User(
        id=uuid.uuid4(),
        email=f"colab-{uuid.uuid4()}@test.com",
        password=hash_password("User123*"),
        name="Zoe",  # nombre tardío en el orden alfabético, para localizarlo fácil
        last_name="Zapata",
        role=SystemRole.USER,
        position=UserPosition.DESARROLLADOR,
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()

    project = Project(id=uuid.uuid4(), name="Proyecto Colab", description="seed")
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

    db_session.add(
        ProjectMember(
            id=uuid.uuid4(),
            project_id=project.id,
            user_id=user.id,
            project_role=ProjectRole.INTEGRANTE,
        )
    )

    team = Team(id=uuid.uuid4(), name=f"Equipo {uuid.uuid4()}")
    db_session.add(team)
    await db_session.flush()
    db_session.add(
        TeamMember(
            id=uuid.uuid4(),
            team_id=team.id,
            user_id=user.id,
            team_role=TeamRole.INTEGRANTE,
        )
    )

    today = datetime.date.today()
    statuses = [
        TaskStatus.COMPLETADA,
        TaskStatus.EN_PROGRESO,
        TaskStatus.PENDIENTE_POR_INICIAR,
        TaskStatus.EN_REVISION,
    ]
    first_task = None
    for i, st in enumerate(statuses):
        task = Task(
            id=uuid.uuid4(),
            title=f"Tarea {i}",
            status=st,
            work_item_id=node.id,
            assignee_id=user.id,
            start_date=today,
            due_date=today + datetime.timedelta(days=i),
        )
        db_session.add(task)
        first_task = first_task or task

    await db_session.flush()
    db_session.add(
        TaskHistory(
            id=uuid.uuid4(),
            task_id=first_task.id,
            changed_by_id=user.id,
            action=HistoryAction.CAMBIO_ESTADO,
            old_status=TaskStatus.EN_PROGRESO,
            new_status=TaskStatus.COMPLETADA,
            change_reason="Trabajo aprobado",
        )
    )

    await db_session.commit()
    await db_session.refresh(user)
    return user


class TestListCollaboratorsRoute:
    async def test_should_require_authentication(self, client):
        response = await client.get("/api/v1/collaborators/")
        assert response.status_code in (401, 403)

    async def test_should_list_collaborator_with_completion_pct(
        self, client, member_headers, collaborator
    ):
        response = await client.get("/api/v1/collaborators/", headers=member_headers)

        assert response.status_code == 200
        body = response.json()
        assert body["page"] == 1
        assert body["page_size"] == 10

        row = next(
            (i for i in body["items"] if i["user_id"] == str(collaborator.id)), None
        )
        assert row is not None
        assert row["assigned_tasks"] == 4
        assert row["completed_tasks"] == 1
        assert row["completion_pct"] == 25  # 1 de 4

    async def test_should_filter_by_search(self, client, member_headers, collaborator):
        response = await client.get(
            "/api/v1/collaborators/",
            headers=member_headers,
            params={"search": "Zapata"},
        )

        assert response.status_code == 200
        items = response.json()["items"]
        assert all("Zapata" in i["last_name"] for i in items)
        assert any(i["user_id"] == str(collaborator.id) for i in items)


class TestCollaboratorActivityRoute:
    async def test_should_return_activity_detail(
        self, client, member_headers, collaborator
    ):
        response = await client.get(
            f"/api/v1/collaborators/{collaborator.id}", headers=member_headers
        )

        assert response.status_code == 200
        body = response.json()
        assert body["user_id"] == str(collaborator.id)
        assert body["assigned_tasks"] == 4
        assert body["completed_tasks"] == 1
        assert body["in_progress_tasks"] == 1
        assert body["completion_pct"] == 25
        assert body["project_count"] == 1
        assert body["team_count"] == 1
        assert len(body["tasks"]) == 4

        assert len(body["history"]) == 1
        entry = body["history"][0]
        assert entry["action"] == HistoryAction.CAMBIO_ESTADO.value
        assert entry["new_status"] == TaskStatus.COMPLETADA.value
        assert entry["task_title"]  # viene del join con Task
        assert entry["change_reason"] == "Trabajo aprobado"

    async def test_should_return_404_for_unknown_user(self, client, member_headers):
        response = await client.get(
            f"/api/v1/collaborators/{uuid.uuid4()}", headers=member_headers
        )
        assert response.status_code == 404
