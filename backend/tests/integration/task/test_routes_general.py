import datetime


async def _project(client, headers) -> str:
    res = await client.post(
        "/api/v1/projects/",
        json={
            "name": "Proyecto general",
            "description": "demo",
            "client_name": "Cliente",
        },
        headers=headers,
    )
    assert res.status_code == 201
    return res.json()["id"]


async def _phase(client, headers, project_id) -> str:
    res = await client.post(
        f"/api/v1/projects/{project_id}/phases",
        json={"name": "Fase 1"},
        headers=headers,
    )
    assert res.status_code == 201
    return res.json()["id"]


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


class TestGeneralTaskCreation:
    async def test_should_create_task_attached_to_phase(self, client, admin_headers):
        project_id = await _project(client, admin_headers)
        phase_id = await _phase(client, admin_headers, project_id)
        today = datetime.date.today().isoformat()
        due = (datetime.date.today() + datetime.timedelta(days=4)).isoformat()

        res = await client.post(
            f"/api/v1/tasks/{project_id}/tasks",
            json={
                "title": "Tarea de fase",
                "phase_id": phase_id,
                "start_date": today,
                "due_date": due,
            },
            headers=admin_headers,
        )
        assert res.status_code == 201, res.text
        body = res.json()
        assert body["phase_id"] == phase_id
        assert body["node_id"] is None

    async def test_should_create_task_with_duration(self, client, admin_headers):
        project_id = await _project(client, admin_headers)
        phase_id = await _phase(client, admin_headers, project_id)
        node_id = await _node(client, admin_headers, project_id, phase_id)
        today = datetime.date.today()

        res = await client.post(
            f"/api/v1/tasks/{project_id}/tasks",
            json={
                "title": "Tarea por duración",
                "node_id": node_id,
                "start_date": today.isoformat(),
                "duration_days": 7,
            },
            headers=admin_headers,
        )
        assert res.status_code == 201, res.text
        assert (
            res.json()["due_date"] == (today + datetime.timedelta(days=7)).isoformat()
        )

    async def test_should_reject_when_both_node_and_phase(self, client, admin_headers):
        project_id = await _project(client, admin_headers)
        phase_id = await _phase(client, admin_headers, project_id)
        node_id = await _node(client, admin_headers, project_id, phase_id)
        today = datetime.date.today().isoformat()
        due = (datetime.date.today() + datetime.timedelta(days=2)).isoformat()

        res = await client.post(
            f"/api/v1/tasks/{project_id}/tasks",
            json={
                "title": "Ambigua",
                "node_id": node_id,
                "phase_id": phase_id,
                "start_date": today,
                "due_date": due,
            },
            headers=admin_headers,
        )
        assert res.status_code == 422

    async def test_should_create_task_with_dependency(self, client, admin_headers):
        project_id = await _project(client, admin_headers)
        phase_id = await _phase(client, admin_headers, project_id)
        today = datetime.date.today().isoformat()
        due = (datetime.date.today() + datetime.timedelta(days=2)).isoformat()

        first = await client.post(
            f"/api/v1/tasks/{project_id}/tasks",
            json={
                "title": "Prerrequisito",
                "phase_id": phase_id,
                "start_date": today,
                "due_date": due,
            },
            headers=admin_headers,
        )
        prereq_id = first.json()["id"]

        second = await client.post(
            f"/api/v1/tasks/{project_id}/tasks",
            json={
                "title": "Dependiente",
                "phase_id": phase_id,
                "start_date": today,
                "due_date": due,
                "depends_on_id": prereq_id,
            },
            headers=admin_headers,
        )
        assert second.status_code == 201, second.text
        dep_task_id = second.json()["id"]

        deps = await client.get(
            f"/api/v1/tasks/{project_id}/tasks/{dep_task_id}/dependencies",
            headers=admin_headers,
        )
        assert deps.status_code == 200
        assert len(deps.json()) == 1


class TestProjectTasks:
    async def test_should_list_node_and_phase_tasks(self, client, admin_headers):
        project_id = await _project(client, admin_headers)
        phase_id = await _phase(client, admin_headers, project_id)
        node_id = await _node(client, admin_headers, project_id, phase_id)
        today = datetime.date.today().isoformat()
        due = (datetime.date.today() + datetime.timedelta(days=2)).isoformat()

        await client.post(
            f"/api/v1/tasks/{project_id}/tasks",
            json={
                "title": "De nodo",
                "node_id": node_id,
                "start_date": today,
                "due_date": due,
            },
            headers=admin_headers,
        )
        await client.post(
            f"/api/v1/tasks/{project_id}/tasks",
            json={
                "title": "De fase",
                "phase_id": phase_id,
                "start_date": today,
                "due_date": due,
            },
            headers=admin_headers,
        )

        res = await client.get(
            f"/api/v1/tasks/{project_id}/tasks", headers=admin_headers
        )
        assert res.status_code == 200
        assert len(res.json()) == 2


class TestDirectory:
    async def test_should_list_active_users(self, client, admin_headers):
        res = await client.get("/api/v1/identity/directory", headers=admin_headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    async def test_should_filter_by_position(self, client, admin_headers):
        res = await client.get(
            "/api/v1/identity/directory?position=desarrollador", headers=admin_headers
        )
        assert res.status_code == 200
        assert all(u["position"] == "desarrollador" for u in res.json())
