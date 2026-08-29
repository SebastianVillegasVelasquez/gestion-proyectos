"""Edición de dependencias FtS entre tareas (fase 3.2).

Se pueden añadir y quitar dependencias en cualquier momento, no solo al crear la
tarea. Al añadir, se rechazan ciclos (directos o transitivos) y dependencias
entre proyectos distintos.
"""

from datetime import date, timedelta

from tests.integration.worktree.test_routes import _create_project

BASE = date.today() + timedelta(days=30)


async def _task(client, admin_headers, project_id, title) -> str:
    r = await client.post(
        "/api/v1/tasks",
        headers=admin_headers,
        json={
            "title": title,
            "project_id": project_id,
            "start_date": BASE.isoformat(),
            "duration_days": 2,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _add_dep(client, admin_headers, task_id, depends_on_id):
    return await client.post(
        f"/api/v1/tasks/{task_id}/dependencies",
        headers=admin_headers,
        json={"depends_on_id": depends_on_id},
    )


class TestEditTaskDependencies:
    async def test_add_and_remove_dependency_after_creation(
        self, client, admin_headers, valid_project_payload
    ):
        pid = await _create_project(client, admin_headers, valid_project_payload)
        a = await _task(client, admin_headers, pid, "Tarea A")
        b = await _task(client, admin_headers, pid, "Tarea B")

        added = await _add_dep(client, admin_headers, a, b)
        assert added.status_code == 201, added.text

        listed = await client.get(
            f"/api/v1/tasks/{a}/dependencies", headers=admin_headers
        )
        assert [d["depends_on_id"] for d in listed.json()] == [b]

        removed = await client.delete(
            f"/api/v1/tasks/{a}/dependencies/{b}", headers=admin_headers
        )
        assert removed.status_code == 204

        listed = await client.get(
            f"/api/v1/tasks/{a}/dependencies", headers=admin_headers
        )
        assert listed.json() == []

    async def test_remove_missing_dependency_is_404(
        self, client, admin_headers, valid_project_payload
    ):
        pid = await _create_project(client, admin_headers, valid_project_payload)
        a = await _task(client, admin_headers, pid, "Tarea A")
        b = await _task(client, admin_headers, pid, "Tarea B")

        r = await client.delete(
            f"/api/v1/tasks/{a}/dependencies/{b}", headers=admin_headers
        )
        assert r.status_code == 404

    async def test_direct_cycle_is_rejected(
        self, client, admin_headers, valid_project_payload
    ):
        pid = await _create_project(client, admin_headers, valid_project_payload)
        a = await _task(client, admin_headers, pid, "Tarea A")
        b = await _task(client, admin_headers, pid, "Tarea B")

        assert (await _add_dep(client, admin_headers, a, b)).status_code == 201
        # B -> A cerraría el ciclo A <-> B.
        clash = await _add_dep(client, admin_headers, b, a)
        assert clash.status_code == 409, clash.text

    async def test_transitive_cycle_is_rejected(
        self, client, admin_headers, valid_project_payload
    ):
        pid = await _create_project(client, admin_headers, valid_project_payload)
        a = await _task(client, admin_headers, pid, "Tarea A")
        b = await _task(client, admin_headers, pid, "Tarea B")
        c = await _task(client, admin_headers, pid, "Tarea C")

        assert (await _add_dep(client, admin_headers, a, b)).status_code == 201
        assert (await _add_dep(client, admin_headers, b, c)).status_code == 201
        # C -> A cerraría el ciclo A -> B -> C -> A.
        clash = await _add_dep(client, admin_headers, c, a)
        assert clash.status_code == 409, clash.text

    async def test_dependency_across_projects_is_rejected(
        self, client, admin_headers, valid_project_payload
    ):
        p1 = await _create_project(client, admin_headers, valid_project_payload)
        p2 = await _create_project(client, admin_headers, valid_project_payload)
        a = await _task(client, admin_headers, p1, "Tarea A")
        other = await _task(client, admin_headers, p2, "Otro proyecto")

        r = await _add_dep(client, admin_headers, a, other)
        assert r.status_code == 422, r.text


class TestDependencyBlocksStatus:
    async def test_cannot_advance_until_dependency_completed(
        self, client, admin_headers, valid_project_payload
    ):
        pid = await _create_project(client, admin_headers, valid_project_payload)
        a = await _task(client, admin_headers, pid, "Tarea A")
        b = await _task(client, admin_headers, pid, "Tarea B")
        assert (await _add_dep(client, admin_headers, a, b)).status_code == 201

        async def move(task, status):
            return await client.patch(
                f"/api/v1/tasks/{task}/status",
                json={"status": status},
                headers=admin_headers,
            )

        # B pendiente -> A no arranca.
        assert (await move(a, "en_progreso")).status_code == 422

        # B en revisión (entregada pero sin aprobar) -> A SIGUE bloqueada.
        assert (await move(b, "en_progreso")).status_code == 200
        assert (await move(b, "en_revision")).status_code == 200
        assert (await move(a, "en_progreso")).status_code == 422

        # B completada -> A ya puede avanzar.
        assert (await move(b, "completada")).status_code == 200
        assert (await move(a, "en_progreso")).status_code == 200

    async def test_cancelling_is_not_blocked_by_dependency(
        self, client, admin_headers, valid_project_payload
    ):
        pid = await _create_project(client, admin_headers, valid_project_payload)
        a = await _task(client, admin_headers, pid, "Tarea A")
        b = await _task(client, admin_headers, pid, "Tarea B")
        assert (await _add_dep(client, admin_headers, a, b)).status_code == 201

        r = await client.patch(
            f"/api/v1/tasks/{a}/status",
            json={"status": "cancelada"},
            headers=admin_headers,
        )
        assert r.status_code == 200, r.text
