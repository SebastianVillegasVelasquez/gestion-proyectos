"""Una tarea puede depender de un elemento del árbol (típico: una «actividad de
terceros»): no avanza hasta que ese elemento está entregado.
"""

from datetime import date, timedelta

from tests.integration.worktree.test_routes import _create_item, _create_project

BASE = (date.today() + timedelta(days=30)).isoformat()


async def _dep_tipo(client, admin_headers, project_id, nombre="Proveedor") -> str:
    r = await client.post(
        f"/api/v1/projects/{project_id}/node-types",
        json={"nombre": nombre, "es_dependencia_externa": True},
        headers=admin_headers,
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _task(client, admin_headers, project_id, title="Trabajo") -> str:
    r = await client.post(
        "/api/v1/tasks",
        headers=admin_headers,
        json={"title": title, "project_id": project_id},
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


class TestTaskDependsOnWorkItem:
    async def test_add_list_and_block_until_the_element_is_delivered(
        self, client, admin_headers, valid_project_payload
    ):
        pid = await _create_project(client, admin_headers, valid_project_payload)
        tercero_tipo = await _dep_tipo(client, admin_headers, pid)
        tercero = await _create_item(
            client, admin_headers, pid, tercero_tipo, "Entrega del proveedor"
        )
        task = await _task(client, admin_headers, pid)

        added = await client.post(
            f"/api/v1/tasks/{task}/dependencies",
            headers=admin_headers,
            json={"depends_on_work_item_id": tercero["id"]},
        )
        assert added.status_code == 201, added.text
        assert added.json()["depends_on_work_item_id"] == tercero["id"]
        assert added.json()["depends_on_id"] is None

        listed = await client.get(
            f"/api/v1/tasks/{task}/dependencies", headers=admin_headers
        )
        assert [d["depends_on_work_item_id"] for d in listed.json()] == [tercero["id"]]

        # El proveedor aún no tiene fecha → la tarea no puede avanzar.
        blocked = await client.patch(
            f"/api/v1/tasks/{task}/status",
            headers=admin_headers,
            json={"status": "en_progreso"},
        )
        assert blocked.status_code == 422

        # Se fija la fecha de entrega del proveedor → se desbloquea.
        await client.patch(
            f"/api/v1/work-items/{tercero['id']}",
            headers=admin_headers,
            json={"fecha_inicio_plan": BASE, "fecha_fin_plan": BASE},
        )
        ok = await client.patch(
            f"/api/v1/tasks/{task}/status",
            headers=admin_headers,
            json={"status": "en_progreso"},
        )
        assert ok.status_code == 200, ok.text

    async def test_remove_via_the_same_endpoint(
        self, client, admin_headers, valid_project_payload
    ):
        pid = await _create_project(client, admin_headers, valid_project_payload)
        tercero_tipo = await _dep_tipo(client, admin_headers, pid)
        tercero = await _create_item(
            client, admin_headers, pid, tercero_tipo, "Proveedor"
        )
        task = await _task(client, admin_headers, pid)
        await client.post(
            f"/api/v1/tasks/{task}/dependencies",
            headers=admin_headers,
            json={"depends_on_work_item_id": tercero["id"]},
        )

        removed = await client.delete(
            f"/api/v1/tasks/{task}/dependencies/{tercero['id']}", headers=admin_headers
        )
        assert removed.status_code == 204
        listed = await client.get(
            f"/api/v1/tasks/{task}/dependencies", headers=admin_headers
        )
        assert listed.json() == []

    async def test_rejects_both_or_neither_target(
        self, client, admin_headers, valid_project_payload
    ):
        pid = await _create_project(client, admin_headers, valid_project_payload)
        task = await _task(client, admin_headers, pid)
        other = await _task(client, admin_headers, pid, "Otra")

        neither = await client.post(
            f"/api/v1/tasks/{task}/dependencies", headers=admin_headers, json={}
        )
        assert neither.status_code == 422

        both = await client.post(
            f"/api/v1/tasks/{task}/dependencies",
            headers=admin_headers,
            json={"depends_on_id": other, "depends_on_work_item_id": other},
        )
        assert both.status_code == 422
