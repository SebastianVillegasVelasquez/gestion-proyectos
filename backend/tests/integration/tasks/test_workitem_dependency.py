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

        # El proveedor aún no entregó → la tarea no puede avanzar.
        blocked = await client.patch(
            f"/api/v1/tasks/{task}/status",
            headers=admin_headers,
            json={"status": "en_progreso"},
        )
        assert blocked.status_code == 422

        # Una fecha PLAN es solo lo previsto: no confirma la entrega, así que la
        # tarea sigue bloqueada.
        await client.patch(
            f"/api/v1/work-items/{tercero['id']}",
            headers=admin_headers,
            json={"fecha_inicio_plan": BASE, "fecha_fin_plan": BASE},
        )
        still_blocked = await client.patch(
            f"/api/v1/tasks/{task}/status",
            headers=admin_headers,
            json={"status": "en_progreso"},
        )
        assert still_blocked.status_code == 422, still_blocked.text

        # Se marca la actividad como ENTREGADA → se desbloquea y la tarea
        # arranca en la fecha de entrega.
        delivered = await client.post(
            f"/api/v1/work-items/{tercero['id']}/deliver",
            headers=admin_headers,
            json={"delivered_on": BASE},
        )
        assert delivered.status_code == 200, delivered.text
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

    async def test_third_party_date_cascades_to_child_element_and_tasks(
        self, client, admin_headers, valid_project_payload
    ):
        pid = await _create_project(client, admin_headers, valid_project_payload)
        tercero_tipo = await _dep_tipo(client, admin_headers, pid)
        normal_tipo = (
            await client.post(
                f"/api/v1/projects/{pid}/node-types",
                json={"nombre": "Componente"},
                headers=admin_headers,
            )
        ).json()["id"]

        tercero = await _create_item(
            client, admin_headers, pid, tercero_tipo, "Entrega del proveedor"
        )
        # La actividad de terceros recibe su fecha prevista: es el INICIO de sus hijos.
        await client.patch(
            f"/api/v1/work-items/{tercero['id']}",
            headers=admin_headers,
            json={"fecha_inicio_plan": BASE},
        )
        hijo = await _create_item(
            client, admin_headers, pid, normal_tipo, "Config del entorno", tercero["id"]
        )
        await client.patch(
            f"/api/v1/work-items/{hijo['id']}",
            headers=admin_headers,
            json={"duracion_valor": 5, "duracion_unidad": "dias"},
        )

        tree = (
            await client.get(
                f"/api/v1/projects/{pid}/work-items", headers=admin_headers
            )
        ).json()
        hijo_node = tree[0]["children"][0]
        assert hijo_node["fecha_inicio_plan"] == BASE
        assert hijo_node["fecha_fin_plan"] == (
            (date.today() + timedelta(days=35)).isoformat()
        )

        # Tarea 1 depende de la actividad de terceros.
        t1 = await _task(client, admin_headers, pid, "Tarea 1")
        await client.post(
            f"/api/v1/tasks/{t1}/dependencies",
            headers=admin_headers,
            json={"depends_on_work_item_id": tercero["id"]},
        )
        # Tarea 2 depende de la tarea 1.
        t2 = await _task(client, admin_headers, pid, "Tarea 2")
        await client.post(
            f"/api/v1/tasks/{t2}/dependencies",
            headers=admin_headers,
            json={"depends_on_id": t1},
        )

        # Se entrega: la tarea 1 arranca en la fecha de entrega.
        await client.post(
            f"/api/v1/work-items/{tercero['id']}/deliver",
            headers=admin_headers,
            json={"delivered_on": BASE},
        )
        t1_after = (
            await client.get(f"/api/v1/tasks/{t1}", headers=admin_headers)
        ).json()
        assert t1_after["start_date"] == BASE

        # Se da a la tarea 1 un fin y se completa → la tarea 2 arranca en ese fin.
        due = (date.today() + timedelta(days=33)).isoformat()
        await client.patch(
            f"/api/v1/tasks/{t1}",
            headers=admin_headers,
            json={"start_date": BASE, "due_date": due},
        )
        done = await client.patch(
            f"/api/v1/tasks/{t1}/status",
            headers=admin_headers,
            json={"status": "completada"},
        )
        assert done.status_code == 200, done.text
        t2_after = (
            await client.get(f"/api/v1/tasks/{t2}", headers=admin_headers)
        ).json()
        assert t2_after["start_date"] == due

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
