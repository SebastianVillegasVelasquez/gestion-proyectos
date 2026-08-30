"""Flujo de trabajo completo de tareas, de punta a punta.

Confirma el camino real de la app:

    admin crea proyecto → crea estructura → crea tareas (asignación
    individual y por equipo) → el líder del equipo ve en su espacio de
    trabajo las tareas sin asignar de ESE proyecto y las reparte entre sus
    integrantes, puede crear y asignar subtareas → según `requires_approval`,
    la tarea o bien exige que el líder/supervisor del PROYECTO
    (coordinador/supervisor, no el `team_role`) la apruebe, o bien queda
    hecha en cuanto el responsable la entrega, sin que nadie más intervenga.

Todas las tareas nacen con `requires_approval=False` si no se indica lo
contrario: es el toggle que decide cuál de los dos caminos sigue cada una.
"""

from datetime import date, timedelta

from app.core.security import create_access_token
from tests.integration.tasks.test_team_tasks import _add_project_member, _create_team
from tests.integration.worktree.test_routes import (
    _create_item,
    _create_project,
    _create_tipo,
)

BASE = date.today() + timedelta(days=30)


def _day(offset: int) -> str:
    return (BASE + timedelta(days=offset)).isoformat()


async def _create_plain_user(
    client, admin_headers, email, name="Test", last_name="User"
):
    resp = await client.post(
        "/api/v1/identity/users",
        headers=admin_headers,
        json={
            "email": email,
            "password": "password123",
            "name": name,
            "last_name": last_name,
            "role": "user",
            "position": "desarrollador",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _headers_for(user_id: str) -> dict:
    return {
        "Authorization": f"Bearer {create_access_token(user_id=user_id, role='user')}"
    }


class TestFullTaskWorkflow:
    """Un solo recorrido de punta a punta con todos los actores del flujo."""

    async def test_end_to_end_workflow(
        self, client, admin_headers, valid_project_payload
    ):
        # 1) Admin crea el proyecto y su estructura.
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        tipo_id = await _create_tipo(client, admin_headers, project_id, "Módulo")
        modulo = await _create_item(
            client, admin_headers, project_id, tipo_id, "Módulo 1"
        )

        # Gente del proyecto: responsable individual, líder y miembro del
        # equipo, y quien revisa (coordinador del PROYECTO).
        integrante = await _create_plain_user(
            client, admin_headers, "integrante-wf@test.com", "Ines", "Grante"
        )
        team_lead = await _create_plain_user(
            client, admin_headers, "lead-wf@test.com", "Leo", "Lider"
        )
        team_member = await _create_plain_user(
            client, admin_headers, "member-wf@test.com", "Emi", "Miembro"
        )
        coordinador = await _create_plain_user(
            client, admin_headers, "coord-wf@test.com", "Cora", "Dina"
        )

        await _add_project_member(client, admin_headers, project_id, integrante["id"])
        await _add_project_member(client, admin_headers, project_id, team_lead["id"])
        await _add_project_member(client, admin_headers, project_id, team_member["id"])
        await _add_project_member(
            client, admin_headers, project_id, coordinador["id"], role="coordinador"
        )

        team_id = await _create_team(client, admin_headers, project_id)
        for user_id, team_role in (
            (team_lead["id"], "lider"),
            (team_member["id"], "integrante"),
        ):
            resp = await client.post(
                f"/api/v1/projects/{project_id}/teams/{team_id}/members",
                headers=admin_headers,
                json={"user_id": user_id, "team_role": team_role},
            )
            assert resp.status_code == 201, resp.text

        # 2) Admin crea una tarea y la asigna INDIVIDUALMENTE, exigiendo
        #    aprobación (el toggle activado a propósito).
        individual = (
            await client.post(
                "/api/v1/tasks",
                headers=admin_headers,
                json={
                    "title": "Guion del curso",
                    "work_item_id": modulo["id"],
                    "assignee_id": integrante["id"],
                    "requires_approval": True,
                    "start_date": _day(0),
                    "duration_days": 5,
                },
            )
        ).json()
        assert individual["assignee_id"] == integrante["id"]
        assert individual["requires_approval"] is True

        # 3) Admin crea una tarea delegada al EQUIPO, sin responsable (bolsa).
        #    Sin indicar el toggle: por defecto no exige aprobación.
        pool = (
            await client.post(
                "/api/v1/tasks",
                headers=admin_headers,
                json={
                    "title": "Video del módulo 1",
                    "work_item_id": modulo["id"],
                    "team_id": team_id,
                    "start_date": _day(0),
                    "duration_days": 5,
                },
            )
        ).json()
        assert pool["assignee_id"] is None
        assert pool["requires_approval"] is False

        # 4) El líder del equipo ve la tarea sin asignar en SU espacio de
        #    trabajo (la bolsa del equipo)...
        lead_headers = _headers_for(team_lead["id"])
        pool_listing = (
            await client.get(f"/api/v1/teams/{team_id}/tasks", headers=lead_headers)
        ).json()
        assert {t["id"] for t in pool_listing} == {pool["id"]}
        assert pool_listing[0]["assignee_id"] is None

        # ...y la reparte entre sus integrantes.
        assigned = await client.patch(
            f"/api/v1/tasks/{pool['id']}",
            headers=lead_headers,
            json={"assignee_id": team_member["id"]},
        )
        assert assigned.status_code == 200, assigned.text
        assert assigned.json()["assignee_id"] == team_member["id"]
        assert assigned.json()["team_id"] == team_id  # sigue siendo del equipo

        # 5) El líder crea y asigna una SUBTAREA de esa tarea del equipo.
        subtask = await client.post(
            f"/api/v1/teams/{team_id}/tasks",
            headers=lead_headers,
            json={
                "title": "Guion del video",
                "parent_task_id": pool["id"],
                "assignee_id": team_member["id"],
            },
        )
        assert subtask.status_code == 201, subtask.text
        subtask_body = subtask.json()
        assert subtask_body["parent_task_id"] == pool["id"]
        assert subtask_body["team_id"] == team_id
        assert subtask_body["work_item_id"] == modulo["id"]  # heredado del padre
        assert subtask_body["requires_approval"] is False  # default también aquí

        # 6) Camino CON aprobación: el responsable entrega, pero no puede
        #    autoaprobarse — solo el coordinador/supervisor del PROYECTO puede.
        integrante_headers = _headers_for(integrante["id"])
        started = await client.patch(
            f"/api/v1/tasks/{individual['id']}/status",
            headers=integrante_headers,
            json={"status": "en_progreso"},
        )
        assert started.status_code == 200, started.text

        submitted = await client.patch(
            f"/api/v1/tasks/{individual['id']}/status",
            headers=integrante_headers,
            json={"status": "en_revision"},
        )
        assert submitted.status_code == 200, submitted.text

        self_approve = await client.patch(
            f"/api/v1/tasks/{individual['id']}/status",
            headers=integrante_headers,
            json={"status": "completada"},
        )
        assert self_approve.status_code == 403, self_approve.text

        coord_headers = _headers_for(coordinador["id"])
        approved = await client.patch(
            f"/api/v1/tasks/{individual['id']}/status",
            headers=coord_headers,
            json={"status": "completada"},
        )
        assert approved.status_code == 200, approved.text
        assert approved.json()["status"] == "completada"

        # 7) Camino SIN aprobación: el responsable entrega y la tarea queda
        #    hecha directo, sin que nadie más tenga que intervenir.
        member_headers = _headers_for(team_member["id"])
        started2 = await client.patch(
            f"/api/v1/tasks/{pool['id']}/status",
            headers=member_headers,
            json={"status": "en_progreso"},
        )
        assert started2.status_code == 200, started2.text

        done = await client.patch(
            f"/api/v1/tasks/{pool['id']}/status",
            headers=member_headers,
            json={"status": "completada"},
        )
        assert done.status_code == 200, done.text
        assert done.json()["status"] == "completada"

        # 8) Al eliminar una tarea, desaparece del proyecto, de la lista del
        #    equipo y del espacio de trabajo del líder (borrado lógico).
        deleted = await client.delete(
            f"/api/v1/tasks/{subtask_body['id']}", headers=admin_headers
        )
        assert deleted.status_code == 204, deleted.text

        project_tasks = (
            await client.get(
                f"/api/v1/projects/{project_id}/tasks", headers=admin_headers
            )
        ).json()
        assert subtask_body["id"] not in {t["id"] for t in project_tasks}

        team_tasks_after = (
            await client.get(f"/api/v1/teams/{team_id}/tasks", headers=lead_headers)
        ).json()
        assert subtask_body["id"] not in {t["id"] for t in team_tasks_after}


class TestRequiresApprovalToggle:
    """El toggle en aislado: quién puede completar según su valor."""

    async def _task_for(
        self,
        client,
        admin_headers,
        project_id,
        work_item_id,
        assignee_id,
        requires_approval,
    ):
        created = await client.post(
            "/api/v1/tasks",
            headers=admin_headers,
            json={
                "title": "Tarea",
                "work_item_id": work_item_id,
                "assignee_id": assignee_id,
                "requires_approval": requires_approval,
                "start_date": _day(0),
                "duration_days": 2,
            },
        )
        assert created.status_code == 201, created.text
        return created.json()

    async def test_default_is_false_when_omitted(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        created = await client.post(
            "/api/v1/tasks",
            headers=admin_headers,
            json={"title": "Sin toggle", "project_id": project_id},
        )
        assert created.status_code == 201, created.text
        assert created.json()["requires_approval"] is False

    async def test_true_blocks_self_complete_and_needs_reviewer(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        tipo_id = await _create_tipo(client, admin_headers, project_id, "Módulo")
        modulo = await _create_item(
            client, admin_headers, project_id, tipo_id, "Módulo 1"
        )
        assignee = await _create_plain_user(
            client, admin_headers, "assignee-ra@test.com"
        )
        reviewer = await _create_plain_user(
            client, admin_headers, "reviewer-ra@test.com"
        )
        await _add_project_member(client, admin_headers, project_id, assignee["id"])
        await _add_project_member(
            client, admin_headers, project_id, reviewer["id"], role="supervisor"
        )

        task = await self._task_for(
            client, admin_headers, project_id, modulo["id"], assignee["id"], True
        )
        assignee_headers = _headers_for(assignee["id"])

        await client.patch(
            f"/api/v1/tasks/{task['id']}/status",
            headers=assignee_headers,
            json={"status": "en_progreso"},
        )
        await client.patch(
            f"/api/v1/tasks/{task['id']}/status",
            headers=assignee_headers,
            json={"status": "en_revision"},
        )

        blocked = await client.patch(
            f"/api/v1/tasks/{task['id']}/status",
            headers=assignee_headers,
            json={"status": "completada"},
        )
        assert blocked.status_code == 403, blocked.text

        approved = await client.patch(
            f"/api/v1/tasks/{task['id']}/status",
            headers=_headers_for(reviewer["id"]),
            json={"status": "completada"},
        )
        assert approved.status_code == 200, approved.text

    async def test_false_lets_assignee_complete_without_a_reviewer(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        tipo_id = await _create_tipo(client, admin_headers, project_id, "Módulo")
        modulo = await _create_item(
            client, admin_headers, project_id, tipo_id, "Módulo 1"
        )
        assignee = await _create_plain_user(
            client, admin_headers, "assignee-noap@test.com"
        )
        await _add_project_member(client, admin_headers, project_id, assignee["id"])

        task = await self._task_for(
            client, admin_headers, project_id, modulo["id"], assignee["id"], False
        )
        assignee_headers = _headers_for(assignee["id"])

        await client.patch(
            f"/api/v1/tasks/{task['id']}/status",
            headers=assignee_headers,
            json={"status": "en_progreso"},
        )
        done = await client.patch(
            f"/api/v1/tasks/{task['id']}/status",
            headers=assignee_headers,
            json={"status": "completada"},
        )
        assert done.status_code == 200, done.text
        assert done.json()["status"] == "completada"

    async def test_false_still_forbids_self_return(
        self, client, admin_headers, valid_project_payload
    ):
        """Sin revisor no hay a quién "devolver": DEVUELTA sigue vetada al
        propio responsable aunque la tarea no exija aprobación."""
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        tipo_id = await _create_tipo(client, admin_headers, project_id, "Módulo")
        modulo = await _create_item(
            client, admin_headers, project_id, tipo_id, "Módulo 1"
        )
        assignee = await _create_plain_user(
            client, admin_headers, "assignee-noret@test.com"
        )
        await _add_project_member(client, admin_headers, project_id, assignee["id"])

        task = await self._task_for(
            client, admin_headers, project_id, modulo["id"], assignee["id"], False
        )
        assignee_headers = _headers_for(assignee["id"])
        await client.patch(
            f"/api/v1/tasks/{task['id']}/status",
            headers=assignee_headers,
            json={"status": "en_progreso"},
        )

        returned = await client.patch(
            f"/api/v1/tasks/{task['id']}/status",
            headers=assignee_headers,
            json={"status": "devuelta"},
        )
        assert returned.status_code == 403, returned.text

    async def test_team_lead_sets_the_toggle_when_creating_a_team_task(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        team_id = await _create_team(client, admin_headers, project_id)
        lead = await _create_plain_user(client, admin_headers, "lead-toggle@test.com")
        await _add_project_member(client, admin_headers, project_id, lead["id"])
        resp = await client.post(
            f"/api/v1/projects/{project_id}/teams/{team_id}/members",
            headers=admin_headers,
            json={"user_id": lead["id"], "team_role": "lider"},
        )
        assert resp.status_code == 201, resp.text

        created = await client.post(
            f"/api/v1/teams/{team_id}/tasks",
            headers=_headers_for(lead["id"]),
            json={"title": "Con revisión", "requires_approval": True},
        )
        assert created.status_code == 201, created.text
        assert created.json()["requires_approval"] is True
