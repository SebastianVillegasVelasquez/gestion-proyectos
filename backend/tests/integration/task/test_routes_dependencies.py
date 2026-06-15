import datetime

from app.modules.tasks.infrastructure.enums import TaskStatus


async def _project(client, headers) -> str:
    res = await client.post(
        "/api/v1/projects/",
        json={
            "name": "Proyecto tareas",
            "description": "demo",
            "client_name": "Cliente",
        },
        headers=headers,
    )
    assert res.status_code == 201
    return res.json()["id"]


async def _phase(client, headers, project_id, name="Fase 1") -> dict:
    res = await client.post(
        f"/api/v1/projects/{project_id}/phases",
        json={"name": name},
        headers=headers,
    )
    assert res.status_code == 201
    return res.json()


async def _node(client, headers, project_id, phase_id) -> str:
    res = await client.post(
        "/api/v1/projects/nodes",
        json={
            "name": "Curso",
            "node_type": "MODULO",
            "project_id": project_id,
            "phase_id": phase_id,
        },
        headers=headers,
    )
    assert res.status_code == 201
    return res.json()["id"]


async def _task(client, headers, project_id, node_id, title="Tarea") -> str:
    today = datetime.date.today().isoformat()
    due = (datetime.date.today() + datetime.timedelta(days=5)).isoformat()
    res = await client.post(
        f"/api/v1/tasks/{project_id}/nodes/{node_id}/tasks",
        json={
            "title": title,
            "start_date": today,
            "due_date": due,
            "priority": "media",
        },
        headers=headers,
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


class TestTaskCreation:
    async def test_should_create_task_against_real_db(self, client, admin_headers):
        project_id = await _project(client, admin_headers)
        phase = await _phase(client, admin_headers, project_id)
        node_id = await _node(client, admin_headers, project_id, phase["id"])

        task_id = await _task(client, admin_headers, project_id, node_id)
        assert task_id

    async def test_should_create_subtask_with_parent(self, client, admin_headers):
        project_id = await _project(client, admin_headers)
        phase = await _phase(client, admin_headers, project_id)
        node_id = await _node(client, admin_headers, project_id, phase["id"])
        parent_id = await _task(client, admin_headers, project_id, node_id, "Global")

        today = datetime.date.today().isoformat()
        due = (datetime.date.today() + datetime.timedelta(days=3)).isoformat()
        res = await client.post(
            f"/api/v1/tasks/{project_id}/nodes/{node_id}/tasks",
            json={
                "title": "Subtarea",
                "start_date": today,
                "due_date": due,
                "priority": "media",
                "parent_task_id": parent_id,
            },
            headers=admin_headers,
        )
        assert res.status_code == 201, res.text
        assert res.json()["parent_task_id"] == parent_id


class TestDependencies:
    async def test_should_add_and_list_dependency(self, client, admin_headers):
        project_id = await _project(client, admin_headers)
        phase = await _phase(client, admin_headers, project_id)
        node_id = await _node(client, admin_headers, project_id, phase["id"])
        a = await _task(client, admin_headers, project_id, node_id, "Tarea A")
        b = await _task(client, admin_headers, project_id, node_id, "Tarea B")

        res = await client.post(
            f"/api/v1/tasks/{project_id}/tasks/{a}/dependencies",
            json={"depends_on_id": b},
            headers=admin_headers,
        )
        assert res.status_code == 201, res.text

        listing = await client.get(
            f"/api/v1/tasks/{project_id}/tasks/{a}/dependencies",
            headers=admin_headers,
        )
        assert listing.status_code == 200
        assert len(listing.json()) == 1
        assert listing.json()[0]["depends_on_id"] == b

    async def test_should_reject_self_dependency(self, client, admin_headers):
        project_id = await _project(client, admin_headers)
        phase = await _phase(client, admin_headers, project_id)
        node_id = await _node(client, admin_headers, project_id, phase["id"])
        a = await _task(client, admin_headers, project_id, node_id, "Tarea A")

        res = await client.post(
            f"/api/v1/tasks/{project_id}/tasks/{a}/dependencies",
            json={"depends_on_id": a},
            headers=admin_headers,
        )
        assert res.status_code == 409


class TestStatusRules:
    async def test_should_block_start_with_incomplete_dependency(
        self, client, admin_headers
    ):
        project_id = await _project(client, admin_headers)
        phase = await _phase(client, admin_headers, project_id)
        node_id = await _node(client, admin_headers, project_id, phase["id"])
        a = await _task(client, admin_headers, project_id, node_id, "Tarea A")
        b = await _task(client, admin_headers, project_id, node_id, "Tarea B")

        await client.post(
            f"/api/v1/tasks/{project_id}/tasks/{a}/dependencies",
            json={"depends_on_id": b},
            headers=admin_headers,
        )

        res = await client.patch(
            f"/api/v1/tasks/{project_id}/tasks/{a}/status",
            json={"status": TaskStatus.EN_PROGRESO.value},
            headers=admin_headers,
        )
        assert res.status_code == 409

    async def test_should_allow_start_after_dependency_completed(
        self, client, admin_headers
    ):
        project_id = await _project(client, admin_headers)
        phase = await _phase(client, admin_headers, project_id)
        node_id = await _node(client, admin_headers, project_id, phase["id"])
        a = await _task(client, admin_headers, project_id, node_id, "Tarea A")
        b = await _task(client, admin_headers, project_id, node_id, "Tarea B")

        await client.post(
            f"/api/v1/tasks/{project_id}/tasks/{a}/dependencies",
            json={"depends_on_id": b},
            headers=admin_headers,
        )
        # Completar la dependencia B
        complete = await client.patch(
            f"/api/v1/tasks/{project_id}/tasks/{b}/status",
            json={"status": TaskStatus.COMPLETADA.value},
            headers=admin_headers,
        )
        assert complete.status_code == 200

        res = await client.patch(
            f"/api/v1/tasks/{project_id}/tasks/{a}/status",
            json={"status": TaskStatus.EN_PROGRESO.value},
            headers=admin_headers,
        )
        assert res.status_code == 200
        assert res.json()["status"] == TaskStatus.EN_PROGRESO.value

    async def test_should_block_start_when_earlier_phase_open(
        self, client, admin_headers
    ):
        project_id = await _project(client, admin_headers)
        phase1 = await _phase(client, admin_headers, project_id, "Fase 1")
        phase2 = await _phase(client, admin_headers, project_id, "Fase 2")
        node1 = await _node(client, admin_headers, project_id, phase1["id"])
        node2 = await _node(client, admin_headers, project_id, phase2["id"])
        # Tarea en fase 1 sin completar
        await _task(client, admin_headers, project_id, node1, "Fase1-Task")
        task2 = await _task(client, admin_headers, project_id, node2, "Fase2-Task")

        res = await client.patch(
            f"/api/v1/tasks/{project_id}/tasks/{task2}/status",
            json={"status": TaskStatus.EN_PROGRESO.value},
            headers=admin_headers,
        )
        assert res.status_code == 409
