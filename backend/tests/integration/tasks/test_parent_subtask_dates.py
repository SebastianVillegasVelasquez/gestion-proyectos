"""Una subtarea nunca termina después de su tarea padre.

Se valida en los dos sentidos y se rechaza en lugar de corregir por detrás:
mover un fin no debe reescribir en silencio las fechas de otras tareas.
"""

from datetime import date, timedelta

from tests.integration.worktree.test_routes import _create_project

BASE = date.today() + timedelta(days=30)


def _day(offset: int) -> str:
    return (BASE + timedelta(days=offset)).isoformat()


async def _task(client, headers, project_id, title, start, due, parent=None):
    payload = {
        "title": title,
        "project_id": project_id,
        "start_date": _day(start),
        "due_date": _day(due),
    }
    if parent:
        payload["parent_task_id"] = parent
    return await client.post("/api/v1/tasks", headers=headers, json=payload)


class TestSubtaskVersusParentDates:
    async def _parent(self, client, admin_headers, valid_project_payload):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        r = await _task(client, admin_headers, project_id, "Padre", 0, 10)
        assert r.status_code == 201, r.text
        return project_id, r.json()["id"]

    async def test_a_subtask_may_end_on_or_before_the_parent(
        self, client, admin_headers, valid_project_payload
    ):
        project_id, parent = await self._parent(
            client, admin_headers, valid_project_payload
        )
        r = await _task(client, admin_headers, project_id, "Hija", 2, 10, parent)
        assert r.status_code == 201, r.text

    async def test_a_subtask_cannot_be_created_past_the_parent(
        self, client, admin_headers, valid_project_payload
    ):
        project_id, parent = await self._parent(
            client, admin_headers, valid_project_payload
        )
        r = await _task(client, admin_headers, project_id, "Hija", 2, 11, parent)
        assert r.status_code == 422, r.text
        assert "tarea padre" in r.text

    async def test_a_subtask_cannot_be_moved_past_the_parent(
        self, client, admin_headers, valid_project_payload
    ):
        project_id, parent = await self._parent(
            client, admin_headers, valid_project_payload
        )
        child = (
            await _task(client, admin_headers, project_id, "Hija", 2, 8, parent)
        ).json()
        r = await client.patch(
            f"/api/v1/tasks/{child['id']}",
            headers=admin_headers,
            json={"due_date": _day(12)},
        )
        assert r.status_code == 422, r.text

    async def test_the_parent_cannot_end_before_its_last_subtask(
        self, client, admin_headers, valid_project_payload
    ):
        project_id, parent = await self._parent(
            client, admin_headers, valid_project_payload
        )
        await _task(client, admin_headers, project_id, "Hija", 2, 9, parent)
        r = await client.patch(
            f"/api/v1/tasks/{parent}", headers=admin_headers, json={"due_date": _day(5)}
        )
        assert r.status_code == 422, r.text
        assert "última subtarea" in r.text

    async def test_moving_the_parent_later_does_not_touch_its_subtasks(
        self, client, admin_headers, valid_project_payload
    ):
        project_id, parent = await self._parent(
            client, admin_headers, valid_project_payload
        )
        child = (
            await _task(client, admin_headers, project_id, "Hija", 2, 9, parent)
        ).json()
        r = await client.patch(
            f"/api/v1/tasks/{parent}",
            headers=admin_headers,
            json={"due_date": _day(20)},
        )
        assert r.status_code == 200, r.text
        again = await client.get(f"/api/v1/tasks/{child['id']}", headers=admin_headers)
        assert again.json()["due_date"] == _day(9)
