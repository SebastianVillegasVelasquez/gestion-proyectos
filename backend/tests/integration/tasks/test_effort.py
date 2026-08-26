"""Esfuerzo de una tarea: estimación y horas realmente dedicadas.

`tasks.estimated_hours` guarda lo que se cree que costará; cada apunte de
`task_time_entries` lo que costó de verdad. Comparar ambos es lo que permite
estimar mejor la próxima vez y sostener un pago por horas.
"""

from datetime import date, timedelta

from tests.integration.worktree.test_routes import _create_project

TODAY = date.today().isoformat()
YESTERDAY = (date.today() - timedelta(days=1)).isoformat()


async def _task(client, admin_headers, valid_project_payload, **extra):
    project_id = await _create_project(client, admin_headers, valid_project_payload)
    body = {"title": "Grabar video 1", "project_id": project_id, **extra}
    created = await client.post("/api/v1/tasks", json=body, headers=admin_headers)
    assert created.status_code == 201, created.text
    return created.json()


class TestEstimatedHours:
    async def test_task_can_be_created_with_an_estimate(
        self, client, admin_headers, valid_project_payload
    ):
        task = await _task(
            client, admin_headers, valid_project_payload, estimated_hours="8.5"
        )
        assert float(task["estimated_hours"]) == 8.5

    async def test_estimate_is_optional(
        self, client, admin_headers, valid_project_payload
    ):
        """Una tarea puede nacer sin estimar y estimarse cuando se sepa de qué va."""
        task = await _task(client, admin_headers, valid_project_payload)
        assert task["estimated_hours"] is None
        assert float(task["logged_hours"]) == 0

    async def test_estimate_can_be_set_later(
        self, client, admin_headers, valid_project_payload
    ):
        task = await _task(client, admin_headers, valid_project_payload)

        updated = await client.patch(
            f"/api/v1/tasks/{task['id']}",
            json={"estimated_hours": "4"},
            headers=admin_headers,
        )

        assert updated.status_code == 200, updated.text
        assert float(updated.json()["estimated_hours"]) == 4

    async def test_rejects_a_negative_estimate(
        self, client, admin_headers, valid_project_payload
    ):
        task = await _task(client, admin_headers, valid_project_payload)
        response = await client.patch(
            f"/api/v1/tasks/{task['id']}",
            json={"estimated_hours": "-3"},
            headers=admin_headers,
        )
        assert response.status_code == 422


class TestTimeEntries:
    async def test_logs_hours_and_adds_them_up(
        self, client, admin_headers, valid_project_payload
    ):
        task = await _task(
            client, admin_headers, valid_project_payload, estimated_hours="8"
        )

        for hours, day in (("3", YESTERDAY), ("2.5", TODAY)):
            logged = await client.post(
                f"/api/v1/tasks/{task['id']}/time-entries",
                json={"hours": hours, "work_date": day},
                headers=admin_headers,
            )
            assert logged.status_code == 201, logged.text

        effort = await client.get(
            f"/api/v1/tasks/{task['id']}/effort", headers=admin_headers
        )
        body = effort.json()
        assert float(body["estimated_hours"]) == 8
        assert float(body["logged_hours"]) == 5.5
        assert len(body["entries"]) == 2

    async def test_entry_is_recorded_under_whoever_logs_it(
        self, client, admin_headers, valid_project_payload, admin_user
    ):
        """No se registra tiempo por otra persona: el apunte lleva el nombre de
        quien lo escribe, que es lo que hace el dato fiable."""
        task = await _task(client, admin_headers, valid_project_payload)

        logged = await client.post(
            f"/api/v1/tasks/{task['id']}/time-entries",
            json={"hours": "2", "work_date": TODAY},
            headers=admin_headers,
        )

        assert logged.json()["user_id"] == str(admin_user.id)
        effort = await client.get(
            f"/api/v1/tasks/{task['id']}/effort", headers=admin_headers
        )
        assert effort.json()["entries"][0]["user_name"]

    async def test_logged_hours_appear_in_the_project_task_list(
        self, client, admin_headers, valid_project_payload
    ):
        """La lista muestra "3 / 8 h" por fila, así que las horas viajan con la
        tarea (resueltas en una sola consulta agregada, no una por fila)."""
        task = await _task(
            client, admin_headers, valid_project_payload, estimated_hours="8"
        )
        await client.post(
            f"/api/v1/tasks/{task['id']}/time-entries",
            json={"hours": "3", "work_date": TODAY},
            headers=admin_headers,
        )

        listed = await client.get(
            f"/api/v1/projects/{task['project_id']}/tasks", headers=admin_headers
        )
        row = next(t for t in listed.json() if t["id"] == task["id"])
        assert float(row["logged_hours"]) == 3
        assert float(row["estimated_hours"]) == 8

    async def test_rejects_zero_or_negative_hours(
        self, client, admin_headers, valid_project_payload
    ):
        task = await _task(client, admin_headers, valid_project_payload)
        for hours in ("0", "-2"):
            response = await client.post(
                f"/api/v1/tasks/{task['id']}/time-entries",
                json={"hours": hours, "work_date": TODAY},
                headers=admin_headers,
            )
            assert response.status_code == 422

    async def test_rejects_more_than_a_day_in_one_entry(
        self, client, admin_headers, valid_project_payload
    ):
        """Un apunte es de un día: 30 horas en una jornada es un dedazo."""
        task = await _task(client, admin_headers, valid_project_payload)
        response = await client.post(
            f"/api/v1/tasks/{task['id']}/time-entries",
            json={"hours": "30", "work_date": TODAY},
            headers=admin_headers,
        )
        assert response.status_code == 422

    async def test_rejects_logging_on_a_task_that_does_not_exist(
        self, client, admin_headers
    ):
        response = await client.post(
            "/api/v1/tasks/00000000-0000-0000-0000-000000000000/time-entries",
            json={"hours": "2", "work_date": TODAY},
            headers=admin_headers,
        )
        assert response.status_code == 404

    async def test_deletes_own_entry(
        self, client, admin_headers, valid_project_payload
    ):
        task = await _task(client, admin_headers, valid_project_payload)
        entry = (
            await client.post(
                f"/api/v1/tasks/{task['id']}/time-entries",
                json={"hours": "2", "work_date": TODAY},
                headers=admin_headers,
            )
        ).json()

        deleted = await client.delete(
            f"/api/v1/time-entries/{entry['id']}", headers=admin_headers
        )

        assert deleted.status_code == 204
        effort = await client.get(
            f"/api/v1/tasks/{task['id']}/effort", headers=admin_headers
        )
        assert float(effort.json()["logged_hours"]) == 0

    async def test_cannot_delete_someone_elses_entry(
        self, client, admin_headers, member_headers, valid_project_payload
    ):
        task = await _task(client, admin_headers, valid_project_payload)
        entry = (
            await client.post(
                f"/api/v1/tasks/{task['id']}/time-entries",
                json={"hours": "2", "work_date": TODAY},
                headers=admin_headers,
            )
        ).json()

        response = await client.delete(
            f"/api/v1/time-entries/{entry['id']}", headers=member_headers
        )

        assert response.status_code == 403

    async def test_a_regular_user_can_log_their_own_hours(
        self, client, admin_headers, member_headers, valid_project_payload
    ):
        """Quien hace el trabajo apunta sus horas; no hace falta ser admin."""
        task = await _task(client, admin_headers, valid_project_payload)

        response = await client.post(
            f"/api/v1/tasks/{task['id']}/time-entries",
            json={"hours": "1.5", "work_date": TODAY},
            headers=member_headers,
        )

        assert response.status_code == 201, response.text
