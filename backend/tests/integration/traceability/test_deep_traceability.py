"""La trazabilidad registra el ACTOR real y no pierde las tareas sueltas.

Dos regresiones que este módulo cubre:

  * El historial se escribía desde los manejadores de notificación, que solo
    conocen al RESPONSABLE de la tarea. El autor del cambio quedaba mal (o nulo
    cuando nadie estaba asignado, que en pantalla se leía "Alguien").
  * El read model unía con `WorkItem` mediante un INNER JOIN, así que TODA
    tarea creada sin ubicación en la estructura desaparecía de la línea de
    tiempo — justo la forma en que se crea una tarea a mano.
"""

import uuid

import pytest_asyncio

from app.modules.project.infrastructure.models import Project
from app.modules.teams.infrastructure.models import Team


@pytest_asyncio.fixture
async def project(db_session):
    project = Project(id=uuid.uuid4(), name="Proyecto Auditado", description="seed")
    db_session.add(project)
    await db_session.commit()
    return project


@pytest_asyncio.fixture
async def team(db_session, project):
    team = Team(id=uuid.uuid4(), project_id=project.id, name="Contenidos")
    db_session.add(team)
    await db_session.commit()
    return team


async def _timeline(client, admin_headers, project_id) -> dict:
    response = await client.get(
        f"/api/v1/projects/{project_id}/traceability", headers=admin_headers
    )
    assert response.status_code == 200, response.text
    return response.json()


class TestStandaloneTaskTraceability:
    async def test_task_without_location_appears_in_the_timeline(
        self, client, admin_headers, project
    ):
        created = await client.post(
            "/api/v1/tasks",
            headers=admin_headers,
            json={"title": "Tarea suelta", "project_id": str(project.id)},
        )
        assert created.status_code == 201, created.text

        body = await _timeline(client, admin_headers, project.id)

        assert body["summary"]["total_events"] == 1
        event = body["events"][0]
        assert event["kind"] == "creacion"
        assert event["task_title"] == "Tarea suelta"
        # Sin ubicación: el evento existe igual y lo dice explícitamente.
        assert event["work_item_name"] is None

    async def test_records_the_user_who_acted_not_the_assignee(
        self, client, admin_headers, admin_user, member_user, project
    ):
        """Quien crea la tarea es el admin, aunque se la asigne a otra persona."""
        created = await client.post(
            "/api/v1/tasks",
            headers=admin_headers,
            json={
                "title": "Tarea asignada a otro",
                "project_id": str(project.id),
                "assignee_id": str(member_user.id),
            },
        )
        assert created.status_code == 201, created.text

        body = await _timeline(client, admin_headers, project.id)
        event = body["events"][0]

        assert admin_user.name in (event["actor_name"] or "")
        assert event["actor_name"] != event["assignee_name"]


class TestManagementChangesAreAudited:
    async def test_team_change_is_recorded_with_readable_values(
        self, client, admin_headers, project, team
    ):
        created = await client.post(
            "/api/v1/tasks",
            headers=admin_headers,
            json={"title": "Montaje", "project_id": str(project.id)},
        )
        task_id = created.json()["id"]

        patched = await client.patch(
            f"/api/v1/tasks/{task_id}",
            headers=admin_headers,
            json={"team_id": str(team.id)},
        )
        assert patched.status_code == 200, patched.text

        body = await _timeline(client, admin_headers, project.id)
        kinds = [e["kind"] for e in body["events"]]
        assert "equipo" in kinds

        change = next(e for e in body["events"] if e["kind"] == "equipo")
        # El delta se guarda ya resuelto a nombres: el historial debe seguir
        # leyéndose aunque el equipo se renombre o se borre después.
        assert change["old_value"] == "Sin equipo"
        assert change["new_value"] == "Contenidos"
        assert body["summary"]["reassignments"] == 1

    async def test_date_change_counts_as_a_reschedule(
        self, client, admin_headers, project
    ):
        created = await client.post(
            "/api/v1/tasks",
            headers=admin_headers,
            json={
                "title": "Grabación",
                "project_id": str(project.id),
                "start_date": "2026-09-01",
                "due_date": "2026-09-10",
            },
        )
        task_id = created.json()["id"]

        patched = await client.patch(
            f"/api/v1/tasks/{task_id}",
            headers=admin_headers,
            json={"due_date": "2026-09-25"},
        )
        assert patched.status_code == 200, patched.text

        body = await _timeline(client, admin_headers, project.id)
        change = next(e for e in body["events"] if e["kind"] == "reprogramacion")
        assert change["old_value"] == "2026-09-01 → 2026-09-10"
        assert change["new_value"] == "2026-09-01 → 2026-09-25"
        assert body["summary"]["reschedules"] == 1

    async def test_a_patch_that_changes_nothing_records_nothing(
        self, client, admin_headers, project
    ):
        created = await client.post(
            "/api/v1/tasks",
            headers=admin_headers,
            json={"title": "Sin cambios", "project_id": str(project.id)},
        )
        task_id = created.json()["id"]

        await client.patch(
            f"/api/v1/tasks/{task_id}",
            headers=admin_headers,
            json={"description": "solo una nota"},
        )

        body = await _timeline(client, admin_headers, project.id)
        # Solo la creación: la descripción no es un campo auditado y ningún
        # campo auditado cambió de valor.
        assert body["summary"]["total_events"] == 1
