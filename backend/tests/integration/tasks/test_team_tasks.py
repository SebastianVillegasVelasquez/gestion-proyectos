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


async def _create_team(
    client, admin_headers, project_id, name="Equipo de Diseño"
) -> str:
    resp = await client.post(
        f"/api/v1/projects/{project_id}/teams",
        json={"name": name},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


class TestTeamTasks:
    async def test_delegate_task_to_team_and_list_it(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        tipo_id = await _create_tipo(client, admin_headers, project_id, "Módulo")
        modulo = await _create_item(
            client, admin_headers, project_id, tipo_id, "Módulo 1"
        )
        team_id = await _create_team(client, admin_headers, project_id)

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
        listed = await client.get(
            f"/api/v1/teams/{team_id}/tasks", headers=admin_headers
        )
        assert listed.status_code == 200, listed.text
        items = listed.json()
        assert len(items) == 1
        item = items[0]
        assert item["title"] == "Banner del Módulo 1"
        assert item["work_item_name"] == "Módulo 1"
        assert item["project_name"] == valid_project_payload["name"]
        assert item["assignee_id"] is None  # aún sin responsable
        # NULL, no " ": concat() de Postgres devolvería un espacio con el LEFT
        # JOIN vacío, y la UI lo pintaría como un nombre en blanco.
        assert item["assignee_name"] is None
        assert item["blocked_by"] == []  # sin dependencias todavía

    async def test_team_tasks_carry_their_blocking_dependencies(
        self, client, admin_headers, valid_project_payload
    ):
        """El workspace pinta "Bloqueada por: X" sin pedir las dependencias por fila."""
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        tipo_id = await _create_tipo(client, admin_headers, project_id, "Módulo")
        modulo = await _create_item(
            client, admin_headers, project_id, tipo_id, "Módulo 1"
        )
        team_id = await _create_team(client, admin_headers, project_id)

        async def _task(title: str) -> str:
            res = await client.post(
                "/api/v1/tasks",
                headers=admin_headers,
                json={
                    "title": title,
                    "work_item_id": modulo["id"],
                    "team_id": team_id,
                    "start_date": _day(0),
                    "duration_days": 5,
                },
            )
            assert res.status_code == 201, res.text
            return res.json()["id"]

        guion_id = await _task("Guion del Módulo 1")
        banner_id = await _task("Banner del Módulo 1")

        # El banner no puede empezar hasta que el guion esté listo (fin-inicio).
        dep = await client.post(
            f"/api/v1/tasks/{banner_id}/dependencies",
            headers=admin_headers,
            json={"depends_on_id": guion_id},
        )
        assert dep.status_code in (200, 201), dep.text

        items = (
            await client.get(f"/api/v1/teams/{team_id}/tasks", headers=admin_headers)
        ).json()
        by_id = {i["id"]: i for i in items}

        assert by_id[banner_id]["blocked_by"] == [
            {
                "id": guion_id,
                "title": "Guion del Módulo 1",
                "status": "pendiente_por_iniciar",
            }
        ]
        # La bloqueante no se ve bloqueada a sí misma.
        assert by_id[guion_id]["blocked_by"] == []

    async def test_task_without_team_is_not_listed(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        tipo_id = await _create_tipo(client, admin_headers, project_id, "Módulo")
        modulo = await _create_item(
            client, admin_headers, project_id, tipo_id, "Módulo 1"
        )
        team_id = await _create_team(client, admin_headers, project_id)

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

        listed = await client.get(
            f"/api/v1/teams/{team_id}/tasks", headers=admin_headers
        )
        assert listed.status_code == 200
        assert listed.json() == []

    async def test_subtask_inherits_team_from_parent(
        self, client, admin_headers, valid_project_payload
    ):
        """Fase 3: el líder crea subtareas de la tarea general del equipo."""
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        tipo_id = await _create_tipo(client, admin_headers, project_id, "Módulo")
        modulo = await _create_item(
            client, admin_headers, project_id, tipo_id, "Módulo 1"
        )
        team_id = await _create_team(client, admin_headers, project_id)

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
        listed = await client.get(
            f"/api/v1/teams/{team_id}/tasks", headers=admin_headers
        )
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
        modulo = await _create_item(
            client, admin_headers, project_id, tipo_id, "Módulo 1"
        )
        team_id = await _create_team(client, admin_headers, project_id)

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

        listed = await client.get(
            f"/api/v1/teams/{team_id}/tasks", headers=admin_headers
        )
        assert len(listed.json()) == 1


class TestTeamLeadReassignment:
    """El líder/supervisor de un equipo puede reasignar SUS tareas entre los
    suyos vía PATCH /tasks/{id}, sin ser admin; nada más."""

    async def _setup(self, client, admin_headers, member_user, valid_project_payload):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        tipo_id = await _create_tipo(client, admin_headers, project_id, "Módulo")
        modulo = await _create_item(
            client, admin_headers, project_id, tipo_id, "Módulo 1"
        )
        team_id = await _create_team(client, admin_headers, project_id)

        mate = (
            await client.post(
                "/api/v1/identity/users",
                headers=admin_headers,
                json={
                    "email": "mate@example.com",
                    "password": "password123",
                    "name": "Mati",
                    "last_name": "Roe",
                    "role": "user",
                    "position": "desarrollador",
                },
            )
        ).json()
        for user_id, role in (
            (str(member_user.id), "lider"),
            (mate["id"], "integrante"),
        ):
            resp = await client.post(
                f"/api/v1/projects/{project_id}/teams/{team_id}/members",
                headers=admin_headers,
                json={"user_id": user_id, "team_role": role},
            )
            assert resp.status_code == 201, resp.text

        task_id = (
            await client.post(
                "/api/v1/tasks",
                headers=admin_headers,
                json={
                    "title": "Banner",
                    "work_item_id": modulo["id"],
                    "team_id": team_id,
                    "start_date": _day(0),
                    "duration_days": 3,
                },
            )
        ).json()["id"]
        return task_id, team_id, mate["id"]

    async def test_lead_can_reassign_within_team_keeping_team_id(
        self, client, admin_headers, member_headers, member_user, valid_project_payload
    ):
        task_id, team_id, mate_id = await self._setup(
            client, admin_headers, member_user, valid_project_payload
        )

        patched = await client.patch(
            f"/api/v1/tasks/{task_id}",
            headers=member_headers,
            json={"assignee_id": mate_id},
        )
        assert patched.status_code == 200, patched.text
        assert patched.json()["assignee_id"] == mate_id
        # La tarea sigue siendo del equipo: el líder podrá volver a reasignarla.
        assert patched.json()["team_id"] == team_id

    async def test_lead_cannot_edit_other_fields(
        self, client, admin_headers, member_headers, member_user, valid_project_payload
    ):
        task_id, _, _ = await self._setup(
            client, admin_headers, member_user, valid_project_payload
        )
        resp = await client.patch(
            f"/api/v1/tasks/{task_id}",
            headers=member_headers,
            json={"title": "Otro título"},
        )
        assert resp.status_code == 403, resp.text

    async def test_lead_cannot_assign_someone_outside_the_team(
        self, client, admin_headers, member_headers, member_user, valid_project_payload
    ):
        task_id, _, _ = await self._setup(
            client, admin_headers, member_user, valid_project_payload
        )
        outsider = (
            await client.post(
                "/api/v1/identity/users",
                headers=admin_headers,
                json={
                    "email": "outsider@example.com",
                    "password": "password123",
                    "name": "Out",
                    "last_name": "Sider",
                    "role": "user",
                    "position": "desarrollador",
                },
            )
        ).json()
        resp = await client.patch(
            f"/api/v1/tasks/{task_id}",
            headers=member_headers,
            json={"assignee_id": outsider["id"]},
        )
        assert resp.status_code == 403, resp.text
