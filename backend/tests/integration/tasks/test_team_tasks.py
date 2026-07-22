"""Fase 1 del espacio de trabajo: delegar una tarea a un equipo y listarla.

Verifica que una tarea puede llevar `team_id` (aditivo: no rompe la creación
normal) y que `GET /teams/{team_id}/tasks` la devuelve con su módulo, proyecto
y responsable resueltos, para agrupar por módulo en el workspace.
"""

from datetime import date, timedelta

from tests.integration.worktree.test_routes import (
    _create_item,
    _create_project,
    _create_tipo,
)

BASE = date.today() + timedelta(days=30)


def _day(offset: int) -> str:
    return (BASE + timedelta(days=offset)).isoformat()


async def _create_team(client, admin_headers, name="Equipo de Diseño") -> str:
    resp = await client.post("/api/v1/teams/", json={"name": name}, headers=admin_headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


class TestTeamTasks:
    async def test_delegate_task_to_team_and_list_it(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        tipo_id = await _create_tipo(client, admin_headers, project_id, "Módulo")
        modulo = await _create_item(client, admin_headers, project_id, tipo_id, "Módulo 1")
        team_id = await _create_team(client, admin_headers)

        # Tarea general delegada al equipo (sin responsable todavía).
        created = await client.post(
            "/api/v1/tasks",
            headers=admin_headers,
            json={
                "title": "Banner del Módulo 1",
                "work_item_id": modulo["id"],
                "team_id": team_id,
                "start_date": _day(0),
                "duration_days": 5,
            },
        )
        assert created.status_code == 201, created.text
        assert created.json()["team_id"] == team_id

        # El workspace lista las tareas del equipo con módulo y proyecto resueltos.
        listed = await client.get(f"/api/v1/teams/{team_id}/tasks", headers=admin_headers)
        assert listed.status_code == 200, listed.text
        items = listed.json()
        assert len(items) == 1
        item = items[0]
        assert item["title"] == "Banner del Módulo 1"
        assert item["work_item_name"] == "Módulo 1"
        assert item["project_name"] == valid_project_payload["name"]
        assert item["assignee_id"] is None  # aún sin responsable

    async def test_task_without_team_is_not_listed(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        tipo_id = await _create_tipo(client, admin_headers, project_id, "Módulo")
        modulo = await _create_item(client, admin_headers, project_id, tipo_id, "Módulo 1")
        team_id = await _create_team(client, admin_headers)

        # Tarea normal del proyecto, SIN equipo (no debe romperse ni aparecer).
        created = await client.post(
            "/api/v1/tasks",
            headers=admin_headers,
            json={
                "title": "Montaje en plataforma",
                "work_item_id": modulo["id"],
                "start_date": _day(0),
                "duration_days": 2,
            },
        )
        assert created.status_code == 201, created.text
        assert created.json()["team_id"] is None

        listed = await client.get(f"/api/v1/teams/{team_id}/tasks", headers=admin_headers)
        assert listed.status_code == 200
        assert listed.json() == []

    async def test_subtask_inherits_team_from_parent(
        self, client, admin_headers, valid_project_payload
    ):
        """Fase 3: el líder crea subtareas de la tarea general del equipo."""
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        tipo_id = await _create_tipo(client, admin_headers, project_id, "Módulo")
        modulo = await _create_item(client, admin_headers, project_id, tipo_id, "Módulo 1")
        team_id = await _create_team(client, admin_headers)

        parent_id = (
            await client.post(
                "/api/v1/tasks",
                headers=admin_headers,
                json={
                    "title": "Banner del Módulo 1",
                    "work_item_id": modulo["id"],
                    "team_id": team_id,
                    "start_date": _day(0),
                    "duration_days": 5,
                },
            )
        ).json()["id"]

        # Subtarea sin team_id explícito: debe heredarlo del padre.
        sub = await client.post(
            "/api/v1/tasks",
            headers=admin_headers,
            json={
                "title": "Diseñar variante móvil",
                "work_item_id": modulo["id"],
                "parent_task_id": parent_id,
                "start_date": _day(0),
                "duration_days": 2,
            },
        )
        assert sub.status_code == 201, sub.text
        assert sub.json()["team_id"] == team_id
        assert sub.json()["parent_task_id"] == parent_id

        # Aparece en GET /teams/{id}/tasks junto a su padre.
        listed = await client.get(f"/api/v1/teams/{team_id}/tasks", headers=admin_headers)
        items = listed.json()
        assert {i["title"] for i in items} == {
            "Banner del Módulo 1",
            "Diseñar variante móvil",
        }

    async def test_reassign_team_via_patch(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        tipo_id = await _create_tipo(client, admin_headers, project_id, "Módulo")
        modulo = await _create_item(client, admin_headers, project_id, tipo_id, "Módulo 1")
        team_id = await _create_team(client, admin_headers)

        task_id = (
            await client.post(
                "/api/v1/tasks",
                headers=admin_headers,
                json={
                    "title": "Banner",
                    "work_item_id": modulo["id"],
                    "start_date": _day(0),
                    "duration_days": 3,
                },
            )
        ).json()["id"]

        patched = await client.patch(
            f"/api/v1/tasks/{task_id}",
            headers=admin_headers,
            json={"team_id": team_id},
        )
        assert patched.status_code == 200, patched.text
        assert patched.json()["team_id"] == team_id

        listed = await client.get(f"/api/v1/teams/{team_id}/tasks", headers=admin_headers)
        assert len(listed.json()) == 1
