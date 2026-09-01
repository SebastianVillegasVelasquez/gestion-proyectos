"""«Mis tareas»: GET /me/tasks devuelve todo lo asignado al usuario, de
cualquier proyecto, con proyecto / elemento / equipo resueltos.
"""

from datetime import date, timedelta

from app.core.security import create_access_token
from tests.integration.tasks.test_team_tasks import (
    _add_project_member,
    _create_team,
)
from tests.integration.worktree.test_routes import (
    _create_item,
    _create_project,
    _create_tipo,
)


def _headers_for(user_id: str) -> dict:
    return {
        "Authorization": f"Bearer {create_access_token(user_id=user_id, role='user')}"
    }


async def _plain_user(client, admin_headers, email) -> dict:
    r = await client.post(
        "/api/v1/identity/users",
        headers=admin_headers,
        json={
            "email": email,
            "password": "password123",
            "name": "Mia",
            "last_name": "Tareas",
            "role": "user",
            "position": "desarrollador",
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


class TestMyTasks:
    async def test_lists_individual_and_team_tasks_with_context(
        self, client, admin_headers, valid_project_payload
    ):
        pid = await _create_project(client, admin_headers, valid_project_payload)
        tipo = await _create_tipo(client, admin_headers, pid, "Módulo")
        modulo = await _create_item(client, admin_headers, pid, tipo, "Módulo 1")
        team_id = await _create_team(client, admin_headers, pid)
        me = await _plain_user(client, admin_headers, "mine-tasks@test.com")
        await _add_project_member(client, admin_headers, pid, me["id"])
        await client.post(
            f"/api/v1/projects/{pid}/teams/{team_id}/members",
            headers=admin_headers,
            json={"user_id": me["id"], "team_role": "integrante"},
        )

        due = (date.today() + timedelta(days=2)).isoformat()
        # Individual (sin equipo).
        await client.post(
            "/api/v1/tasks",
            headers=admin_headers,
            json={
                "title": "Tarea individual",
                "project_id": pid,
                "assignee_id": me["id"],
                "start_date": date.today().isoformat(),
                "due_date": due,
            },
        )
        # De equipo, asignada directo a mí.
        await client.post(
            "/api/v1/tasks",
            headers=admin_headers,
            json={
                "title": "Tarea de equipo",
                "work_item_id": modulo["id"],
                "team_id": team_id,
                "assignee_id": me["id"],
            },
        )
        # De otra persona: no debe aparecer.
        other = await _plain_user(client, admin_headers, "other-tasks@test.com")
        await client.post(
            "/api/v1/tasks",
            headers=admin_headers,
            json={
                "title": "No es mía",
                "project_id": pid,
                "assignee_id": other["id"],
            },
        )

        r = await client.get("/api/v1/me/tasks", headers=_headers_for(me["id"]))
        assert r.status_code == 200, r.text
        items = r.json()
        by_title = {i["title"]: i for i in items}
        assert set(by_title) == {"Tarea individual", "Tarea de equipo"}

        assert by_title["Tarea individual"]["team_id"] is None
        assert (
            by_title["Tarea individual"]["project_name"]
            == valid_project_payload["name"]
        )
        assert by_title["Tarea individual"]["due_date"] == due

        assert by_title["Tarea de equipo"]["team_id"] == team_id
        assert by_title["Tarea de equipo"]["team_name"] is not None
        assert by_title["Tarea de equipo"]["work_item_name"] == "Módulo 1"

    async def test_requires_authentication(self, client):
        r = await client.get("/api/v1/me/tasks")
        assert r.status_code == 401
