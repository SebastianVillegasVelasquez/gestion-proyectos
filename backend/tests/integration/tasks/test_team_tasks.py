"""Fase 1 del espacio de trabajo: delegar una tarea a un equipo y listarla.

Verifica que una tarea puede llevar `team_id` (aditivo: no rompe la creación
normal) y que `GET /teams/{team_id}/tasks` la devuelve con su módulo, proyecto
y responsable resueltos, para agrupar por módulo en el workspace.
"""

from datetime import date, timedelta

from app.core.security import create_access_token
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


async def _add_project_member(
    client, admin_headers, project_id, user_id, role="integrante"
) -> None:
    """Alta en el proyecto: precondición para poder entrar a un equipo."""
    resp = await client.post(
        "/api/v1/projects/members/",
        json={
            "user_id": str(user_id),
            "project_id": str(project_id),
            "project_role": role,
        },
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text


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

    async def test_subtask_inherits_work_item_from_parent(
        self, client, admin_headers, valid_project_payload
    ):
        """La subtarea sin `work_item_id` cuelga del MISMO elemento del padre,
        así se ve en la estructura y el cronograma (no queda fuera del árbol)."""
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
                    "title": "Tarea general",
                    "work_item_id": modulo["id"],
                    "team_id": team_id,
                    "start_date": _day(0),
                    "duration_days": 5,
                },
            )
        ).json()["id"]

        sub = await client.post(
            "/api/v1/tasks",
            headers=admin_headers,
            json={
                "title": "Subtarea sin ubicar",
                "project_id": project_id,
                "parent_task_id": parent_id,
                "start_date": _day(0),
                "duration_days": 2,
            },
        )
        assert sub.status_code == 201, sub.text
        assert sub.json()["work_item_id"] == modulo["id"]

        # Y por tanto aparece entre las tareas del elemento.
        node_tasks = await client.get(
            f"/api/v1/work-items/{modulo['id']}/tasks", headers=admin_headers
        )
        assert "Subtarea sin ubicar" in {t["title"] for t in node_tasks.json()}

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
    """El líder/supervisor de un equipo edita y elimina las tareas DE SU
    EQUIPO vía PATCH/DELETE /tasks/{id}, sin ser admin — pero solo esas."""

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
            await _add_project_member(client, admin_headers, project_id, user_id)
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

    async def test_lead_can_edit_task_fields_within_its_team(
        self, client, admin_headers, member_headers, member_user, valid_project_payload
    ):
        task_id, _, _ = await self._setup(
            client, admin_headers, member_user, valid_project_payload
        )
        resp = await client.patch(
            f"/api/v1/tasks/{task_id}",
            headers=member_headers,
            json={
                "title": "Otro título",
                "priority": "alta",
                "requires_approval": True,
            },
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["title"] == "Otro título"
        assert body["priority"] == "alta"
        assert body["requires_approval"] is True

    async def test_lead_cannot_move_task_to_another_team(
        self, client, admin_headers, member_headers, member_user, valid_project_payload
    ):
        task_id, _, _ = await self._setup(
            client, admin_headers, member_user, valid_project_payload
        )
        task = (
            await client.get(f"/api/v1/tasks/{task_id}", headers=admin_headers)
        ).json()
        other_team_id = await _create_team(
            client, admin_headers, task["project_id"], name="Otro equipo"
        )
        resp = await client.patch(
            f"/api/v1/tasks/{task_id}",
            headers=member_headers,
            json={"team_id": other_team_id},
        )
        assert resp.status_code == 403, resp.text

    async def test_lead_can_delete_a_task_of_its_team(
        self, client, admin_headers, member_headers, member_user, valid_project_payload
    ):
        task_id, _, _ = await self._setup(
            client, admin_headers, member_user, valid_project_payload
        )
        resp = await client.delete(f"/api/v1/tasks/{task_id}", headers=member_headers)
        assert resp.status_code == 204, resp.text

        listed = await client.get(f"/api/v1/tasks/{task_id}", headers=admin_headers)
        assert listed.status_code == 404

    async def test_deleting_a_task_cascades_to_its_subtasks(
        self, client, admin_headers, member_headers, member_user, valid_project_payload
    ):
        task_id, team_id, mate_id = await self._setup(
            client, admin_headers, member_user, valid_project_payload
        )
        subtask_id = (
            await client.post(
                f"/api/v1/teams/{team_id}/tasks",
                headers=member_headers,
                json={
                    "title": "Subtarea",
                    "parent_task_id": task_id,
                    "assignee_id": mate_id,
                },
            )
        ).json()["id"]

        resp = await client.delete(f"/api/v1/tasks/{task_id}", headers=member_headers)
        assert resp.status_code == 204, resp.text

        listed = await client.get(f"/api/v1/tasks/{subtask_id}", headers=admin_headers)
        assert listed.status_code == 404

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


class TestCreateTeamTask:
    """POST /teams/{team_id}/tasks: el líder/supervisor crea tareas de SU equipo
    sin ser admin (POST /tasks sigue siendo solo-admin)."""

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
                    "email": "teammate-ctt@example.com",
                    "password": "password123",
                    "name": "Tea",
                    "last_name": "Mate",
                    "role": "user",
                    "position": "desarrollador",
                },
            )
        ).json()
        for user_id, role in (
            (str(member_user.id), "lider"),
            (mate["id"], "integrante"),
        ):
            await _add_project_member(client, admin_headers, project_id, user_id)
            resp = await client.post(
                f"/api/v1/projects/{project_id}/teams/{team_id}/members",
                headers=admin_headers,
                json={"user_id": user_id, "team_role": role},
            )
            assert resp.status_code == 201, resp.text
        return project_id, team_id, modulo["id"], mate["id"]

    async def test_lead_creates_pool_task(
        self, client, admin_headers, member_headers, member_user, valid_project_payload
    ):
        _, team_id, item_id, _ = await self._setup(
            client, admin_headers, member_user, valid_project_payload
        )
        resp = await client.post(
            f"/api/v1/teams/{team_id}/tasks",
            headers=member_headers,
            json={"title": "Guion del módulo", "work_item_id": item_id},
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["team_id"] == team_id
        assert body["assignee_id"] is None

        listed = await client.get(
            f"/api/v1/teams/{team_id}/tasks", headers=member_headers
        )
        assert [t["title"] for t in listed.json()] == ["Guion del módulo"]

    async def test_lead_creates_task_already_assigned_to_a_member(
        self, client, admin_headers, member_headers, member_user, valid_project_payload
    ):
        _, team_id, item_id, mate_id = await self._setup(
            client, admin_headers, member_user, valid_project_payload
        )
        resp = await client.post(
            f"/api/v1/teams/{team_id}/tasks",
            headers=member_headers,
            json={
                "title": "Montaje",
                "work_item_id": item_id,
                "assignee_id": mate_id,
            },
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        # Estado válido «tarea del equipo con responsable».
        assert body["assignee_id"] == mate_id
        assert body["team_id"] == team_id

    async def test_lead_creates_subtask_inheriting_parent_context(
        self, client, admin_headers, member_headers, member_user, valid_project_payload
    ):
        _, team_id, item_id, mate_id = await self._setup(
            client, admin_headers, member_user, valid_project_payload
        )
        parent_id = (
            await client.post(
                f"/api/v1/teams/{team_id}/tasks",
                headers=member_headers,
                json={"title": "Tarea general", "work_item_id": item_id},
            )
        ).json()["id"]

        resp = await client.post(
            f"/api/v1/teams/{team_id}/tasks",
            headers=member_headers,
            json={
                "title": "Subtarea concreta",
                "parent_task_id": parent_id,
                "assignee_id": mate_id,
            },
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["parent_task_id"] == parent_id
        assert body["team_id"] == team_id
        assert body["work_item_id"] == item_id  # heredado del padre
        assert body["assignee_id"] == mate_id

    async def test_integrante_cannot_create_team_tasks(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        team_id = await _create_team(client, admin_headers, project_id)
        plain = (
            await client.post(
                "/api/v1/identity/users",
                headers=admin_headers,
                json={
                    "email": "plain-integrante@example.com",
                    "password": "password123",
                    "name": "Pla",
                    "last_name": "In",
                    "role": "user",
                    "position": "desarrollador",
                },
            )
        ).json()
        await _add_project_member(client, admin_headers, project_id, plain["id"])
        await client.post(
            f"/api/v1/projects/{project_id}/teams/{team_id}/members",
            headers=admin_headers,
            json={"user_id": plain["id"], "team_role": "integrante"},
        )
        headers = {
            "Authorization": f"Bearer {create_access_token(user_id=plain['id'], role='user')}"
        }

        resp = await client.post(
            f"/api/v1/teams/{team_id}/tasks",
            headers=headers,
            json={"title": "No debería"},
        )
        assert resp.status_code == 403, resp.text

    async def test_cannot_assign_outside_the_team(
        self, client, admin_headers, member_headers, member_user, valid_project_payload
    ):
        _, team_id, item_id, _ = await self._setup(
            client, admin_headers, member_user, valid_project_payload
        )
        outsider = (
            await client.post(
                "/api/v1/identity/users",
                headers=admin_headers,
                json={
                    "email": "ctt-outsider@example.com",
                    "password": "password123",
                    "name": "Out",
                    "last_name": "Sider",
                    "role": "user",
                    "position": "desarrollador",
                },
            )
        ).json()
        resp = await client.post(
            f"/api/v1/teams/{team_id}/tasks",
            headers=member_headers,
            json={
                "title": "X",
                "work_item_id": item_id,
                "assignee_id": outsider["id"],
            },
        )
        assert resp.status_code == 422, resp.text
