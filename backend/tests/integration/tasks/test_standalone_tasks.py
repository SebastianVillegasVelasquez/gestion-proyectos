"""Tareas sueltas: se crean sin estructura y se adjuntan a un elemento después.

Cubre la nueva capacidad: `project_id` sin `work_item_id` al crear, y los
endpoints `PATCH /tasks/{id}/attach` y `PATCH /tasks/{id}/detach`.
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


class TestCreateStandaloneTask:
    async def test_create_task_without_work_item(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)

        created = await client.post(
            "/api/v1/tasks",
            headers=admin_headers,
            json={
                "title": "Definir alcance",
                "project_id": project_id,
                "start_date": _day(0),
                "duration_days": 3,
            },
        )
        assert created.status_code == 201, created.text
        body = created.json()
        assert body["project_id"] == project_id
        assert body["work_item_id"] is None

    async def test_create_task_without_dates(
        self, client, admin_headers, valid_project_payload
    ):
        # Una tarea puede nacer como borrador: solo título + ancla, sin fechas.
        project_id = await _create_project(client, admin_headers, valid_project_payload)

        created = await client.post(
            "/api/v1/tasks",
            headers=admin_headers,
            json={"title": "Por planificar", "project_id": project_id},
        )
        assert created.status_code == 201, created.text
        body = created.json()
        assert body["start_date"] is None
        assert body["due_date"] is None

    async def test_create_requires_project_or_work_item(self, client, admin_headers):
        response = await client.post(
            "/api/v1/tasks",
            headers=admin_headers,
            json={
                "title": "Sin ancla",
                "start_date": _day(0),
                "duration_days": 1,
            },
        )
        assert response.status_code == 422

    async def test_create_rejects_project_work_item_mismatch(
        self, client, admin_headers, valid_project_payload
    ):
        project_a = await _create_project(client, admin_headers, valid_project_payload)
        project_b = await _create_project(client, admin_headers, valid_project_payload)
        tipo_id = await _create_tipo(client, admin_headers, project_a, "Módulo")
        modulo = await _create_item(
            client, admin_headers, project_a, tipo_id, "Módulo 1"
        )

        response = await client.post(
            "/api/v1/tasks",
            headers=admin_headers,
            json={
                "title": "Cruzada",
                "project_id": project_b,
                "work_item_id": modulo["id"],
                "start_date": _day(0),
                "duration_days": 1,
            },
        )
        assert response.status_code == 422

    async def test_standalone_task_appears_in_project_listing(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)

        await client.post(
            "/api/v1/tasks",
            headers=admin_headers,
            json={
                "title": "Suelta",
                "project_id": project_id,
                "start_date": _day(0),
                "duration_days": 1,
            },
        )

        listed = await client.get(
            f"/api/v1/projects/{project_id}/tasks", headers=admin_headers
        )
        assert listed.status_code == 200
        titles = {t["title"] for t in listed.json()}
        assert "Suelta" in titles


class TestAttachAndDetachTask:
    async def test_attach_standalone_task_to_work_item(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        tipo_id = await _create_tipo(client, admin_headers, project_id, "Módulo")
        modulo = await _create_item(
            client, admin_headers, project_id, tipo_id, "Módulo 1"
        )

        task_id = (
            await client.post(
                "/api/v1/tasks",
                headers=admin_headers,
                json={
                    "title": "Suelta",
                    "project_id": project_id,
                    "start_date": _day(0),
                    "duration_days": 1,
                },
            )
        ).json()["id"]

        attached = await client.patch(
            f"/api/v1/tasks/{task_id}/attach",
            headers=admin_headers,
            json={"work_item_id": modulo["id"]},
        )
        assert attached.status_code == 200, attached.text
        assert attached.json()["work_item_id"] == modulo["id"]

        listed = await client.get(
            f"/api/v1/work-items/{modulo['id']}/tasks", headers=admin_headers
        )
        assert listed.status_code == 200
        assert len(listed.json()) == 1

    async def test_attach_rejects_work_item_from_another_project(
        self, client, admin_headers, valid_project_payload
    ):
        project_a = await _create_project(client, admin_headers, valid_project_payload)
        project_b = await _create_project(client, admin_headers, valid_project_payload)
        tipo_b = await _create_tipo(client, admin_headers, project_b, "Módulo")
        modulo_b = await _create_item(
            client, admin_headers, project_b, tipo_b, "Módulo B"
        )

        task_id = (
            await client.post(
                "/api/v1/tasks",
                headers=admin_headers,
                json={
                    "title": "Suelta en A",
                    "project_id": project_a,
                    "start_date": _day(0),
                    "duration_days": 1,
                },
            )
        ).json()["id"]

        attached = await client.patch(
            f"/api/v1/tasks/{task_id}/attach",
            headers=admin_headers,
            json={"work_item_id": modulo_b["id"]},
        )
        assert attached.status_code == 422

    async def test_detach_returns_task_to_standalone(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        tipo_id = await _create_tipo(client, admin_headers, project_id, "Módulo")
        modulo = await _create_item(
            client, admin_headers, project_id, tipo_id, "Módulo 1"
        )

        task_id = (
            await client.post(
                "/api/v1/tasks",
                headers=admin_headers,
                json={
                    "title": "Adjunta",
                    "work_item_id": modulo["id"],
                    "start_date": _day(0),
                    "duration_days": 1,
                },
            )
        ).json()["id"]

        detached = await client.patch(
            f"/api/v1/tasks/{task_id}/detach", headers=admin_headers
        )
        assert detached.status_code == 200, detached.text
        assert detached.json()["work_item_id"] is None
        assert detached.json()["project_id"] == project_id
