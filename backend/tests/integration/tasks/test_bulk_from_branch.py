"""Carga masiva de tareas a partir de una rama de la estructura.

`POST /work-items/{id}/tasks/bulk`: convierte de una vez las piezas de una
unidad en trabajo asignado, que es lo que se hace al montar un proyecto.
"""

from tests.integration.worktree.test_routes import (
    _create_item,
    _create_project,
    _create_tipo,
)


async def _branch(client, admin_headers, valid_project_payload):
    """Unidad 1 ─ Video (Guion, Grabación) ─ Quiz."""
    project_id = await _create_project(client, admin_headers, valid_project_payload)
    tipo_id = await _create_tipo(client, admin_headers, project_id, "Elemento")
    unidad = await _create_item(client, admin_headers, project_id, tipo_id, "Unidad 1")
    video = await _create_item(
        client, admin_headers, project_id, tipo_id, "Video", parent_id=unidad["id"]
    )
    await _create_item(
        client, admin_headers, project_id, tipo_id, "Guion", parent_id=video["id"]
    )
    await _create_item(
        client, admin_headers, project_id, tipo_id, "Grabación", parent_id=video["id"]
    )
    await _create_item(
        client, admin_headers, project_id, tipo_id, "Quiz", parent_id=unidad["id"]
    )
    return project_id, unidad


class TestBulkTasksFromBranch:
    async def test_creates_one_task_per_leaf(
        self, client, admin_headers, valid_project_payload
    ):
        _, unidad = await _branch(client, admin_headers, valid_project_payload)

        response = await client.post(
            f"/api/v1/work-items/{unidad['id']}/tasks/bulk",
            json={},
            headers=admin_headers,
        )

        assert response.status_code == 201, response.text
        body = response.json()
        # Por defecto solo las hojas: "Unidad 1" y "Video" son agrupadores.
        assert sorted(t["title"] for t in body["created"]) == [
            "Grabación",
            "Guion",
            "Quiz",
        ]
        assert body["skipped"] == []

    async def test_can_include_the_container_elements(
        self, client, admin_headers, valid_project_payload
    ):
        _, unidad = await _branch(client, admin_headers, valid_project_payload)

        response = await client.post(
            f"/api/v1/work-items/{unidad['id']}/tasks/bulk",
            json={"only_leaves": False},
            headers=admin_headers,
        )

        assert response.status_code == 201, response.text
        assert len(response.json()["created"]) == 5

    async def test_each_task_hangs_from_its_element(
        self, client, admin_headers, valid_project_payload
    ):
        project_id, unidad = await _branch(client, admin_headers, valid_project_payload)

        created = (
            await client.post(
                f"/api/v1/work-items/{unidad['id']}/tasks/bulk",
                json={},
                headers=admin_headers,
            )
        ).json()["created"]

        # Cada tarea queda anclada a SU elemento (no todas a la raíz de la rama).
        assert len({t["work_item_id"] for t in created}) == 3
        assert all(t["project_id"] == project_id for t in created)

    async def test_relaunching_only_creates_what_is_missing(
        self, client, admin_headers, valid_project_payload
    ):
        """Volver a lanzarlo sobre la misma rama no duplica: es la diferencia
        entre poder repetir la operación sin miedo o tener que revisar antes."""
        _, unidad = await _branch(client, admin_headers, valid_project_payload)
        await client.post(
            f"/api/v1/work-items/{unidad['id']}/tasks/bulk",
            json={},
            headers=admin_headers,
        )

        second = await client.post(
            f"/api/v1/work-items/{unidad['id']}/tasks/bulk",
            json={},
            headers=admin_headers,
        )

        body = second.json()
        assert body["created"] == []
        assert sorted(s["nombre"] for s in body["skipped"]) == [
            "Grabación",
            "Guion",
            "Quiz",
        ]
        assert all(s["motivo"] == "Ya tiene una tarea" for s in body["skipped"])

    async def test_can_force_duplicates_when_asked(
        self, client, admin_headers, valid_project_payload
    ):
        _, unidad = await _branch(client, admin_headers, valid_project_payload)
        await client.post(
            f"/api/v1/work-items/{unidad['id']}/tasks/bulk",
            json={},
            headers=admin_headers,
        )

        second = await client.post(
            f"/api/v1/work-items/{unidad['id']}/tasks/bulk",
            json={"skip_with_tasks": False},
            headers=admin_headers,
        )

        assert len(second.json()["created"]) == 3

    async def test_assigns_every_task_to_the_same_person(
        self, client, admin_headers, valid_project_payload, admin_user
    ):
        _, unidad = await _branch(client, admin_headers, valid_project_payload)

        created = (
            await client.post(
                f"/api/v1/work-items/{unidad['id']}/tasks/bulk",
                json={"assignee_id": str(admin_user.id), "priority": "alta"},
                headers=admin_headers,
            )
        ).json()["created"]

        assert all(t["assignee_id"] == str(admin_user.id) for t in created)
        assert all(t["priority"] == "alta" for t in created)

    async def test_rejects_assigning_to_person_and_team_at_once(
        self, client, admin_headers, valid_project_payload, admin_user
    ):
        _, unidad = await _branch(client, admin_headers, valid_project_payload)

        response = await client.post(
            f"/api/v1/work-items/{unidad['id']}/tasks/bulk",
            json={
                "assignee_id": str(admin_user.id),
                "team_id": str(admin_user.id),
            },
            headers=admin_headers,
        )

        assert response.status_code == 422

    async def test_requires_an_existing_element(self, client, admin_headers):
        response = await client.post(
            "/api/v1/work-items/00000000-0000-0000-0000-000000000000/tasks/bulk",
            json={},
            headers=admin_headers,
        )
        assert response.status_code == 404

    async def test_regular_user_cannot_bulk_create(
        self, client, admin_headers, member_headers, valid_project_payload
    ):
        _, unidad = await _branch(client, admin_headers, valid_project_payload)

        response = await client.post(
            f"/api/v1/work-items/{unidad['id']}/tasks/bulk",
            json={},
            headers=member_headers,
        )
        assert response.status_code == 403
