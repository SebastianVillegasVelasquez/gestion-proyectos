import datetime
import uuid

import pytest_asyncio

from app.core.security import hash_password
from app.modules.identity.infrastructure.enums import SystemRole, UserPosition
from app.modules.identity.infrastructure.models import User
from app.modules.project.infrastructure.enums import NodeType, ProjectRole
from app.modules.project.infrastructure.models import (
    Project,
    ProjectMember,
    ProjectNode,
)
from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.tasks.infrastructure.models import Task


async def _user(db_session, position: UserPosition) -> User:
    user = User(
        id=uuid.uuid4(),
        email=f"u-{uuid.uuid4()}@test.com",
        password=hash_password("User123*"),
        name="N",
        last_name="A",
        role=SystemRole.USER,
        position=position,
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def project_with_areas(db_session):
    """Proyecto con tareas de 2 áreas: desarrollo (2/3) y diseño gráfico (0/1)."""
    project = Project(id=uuid.uuid4(), name="Proyecto Áreas", description="seed")
    db_session.add(project)
    await db_session.flush()

    node = ProjectNode(
        id=uuid.uuid4(),
        name="Programa",
        node_type=NodeType.PROGRAMA,
        project_id=project.id,
    )
    db_session.add(node)

    dev = await _user(db_session, UserPosition.DESARROLLADOR)
    designer = await _user(db_session, UserPosition.DISENADOR_GRAFICO)

    today = datetime.date.today()

    def task(assignee_id, status):
        db_session.add(
            Task(
                id=uuid.uuid4(),
                title="T",
                status=status,
                node_id=node.id,
                assignee_id=assignee_id,
                start_date=today,
                due_date=today,
            )
        )

    task(dev.id, TaskStatus.COMPLETADA)
    task(dev.id, TaskStatus.COMPLETADA)
    task(dev.id, TaskStatus.EN_PROGRESO)
    task(designer.id, TaskStatus.EN_PROGRESO)

    await db_session.commit()
    return project


class TestProjectAreasRoute:
    async def test_should_require_authentication(self, client, project_with_areas):
        response = await client.get(f"/api/v1/projects/{project_with_areas.id}/areas")
        assert response.status_code in (401, 403)

    async def test_admin_should_get_area_progress(
        self, client, admin_headers, project_with_areas
    ):
        response = await client.get(
            f"/api/v1/projects/{project_with_areas.id}/areas", headers=admin_headers
        )

        assert response.status_code == 200
        body = response.json()
        assert body["total_assigned"] == 4
        assert body["total_completed"] == 2

        by_pos = {a["position"]: a for a in body["areas"]}
        assert by_pos["desarrollador"]["assigned_tasks"] == 3
        assert by_pos["desarrollador"]["completion_pct"] == 67  # 2/3
        assert by_pos["diseñador_grafico"]["completion_pct"] == 0
        # Ordenado por carga: desarrollo (3 tareas) va primero.
        assert body["areas"][0]["position"] == "desarrollador"

    async def test_should_return_404_for_unknown_project(self, client, admin_headers):
        response = await client.get(
            f"/api/v1/projects/{uuid.uuid4()}/areas", headers=admin_headers
        )
        assert response.status_code == 404

    async def test_should_forbid_non_member(
        self, client, member_headers, member_user, project_with_areas
    ):
        response = await client.get(
            f"/api/v1/projects/{project_with_areas.id}/areas", headers=member_headers
        )
        assert response.status_code == 403

    async def test_should_allow_project_coordinator(
        self, client, member_headers, member_user, project_with_areas, db_session
    ):
        db_session.add(
            ProjectMember(
                id=uuid.uuid4(),
                project_id=project_with_areas.id,
                user_id=member_user.id,
                project_role=ProjectRole.COORDINADOR,
            )
        )
        await db_session.commit()

        response = await client.get(
            f"/api/v1/projects/{project_with_areas.id}/areas", headers=member_headers
        )
        assert response.status_code == 200
