"""Informe de estado de un proyecto y su exportación a CSV.

Es lo que se enseña fuera del sistema (a dirección o a un cliente), así que
tiene que traer el contexto resuelto —elemento, responsable, horas— y abrirse
bien en Excel.
"""

from datetime import date, timedelta

from tests.integration.worktree.test_routes import (
    _create_item,
    _create_project,
    _create_tipo,
)

TODAY = date.today().isoformat()


async def _project_with_work(client, admin_headers, valid_project_payload, admin_user):
    project_id = await _create_project(client, admin_headers, valid_project_payload)
    tipo_id = await _create_tipo(client, admin_headers, project_id, "Elemento")
    unidad = await _create_item(client, admin_headers, project_id, tipo_id, "Unidad 1")

    task = (
        await client.post(
            "/api/v1/tasks",
            json={
                "title": "Grabar video",
                "work_item_id": unidad["id"],
                "assignee_id": str(admin_user.id),
                "estimated_hours": "8",
                "start_date": TODAY,
                "due_date": (date.today() + timedelta(days=3)).isoformat(),
            },
            headers=admin_headers,
        )
    ).json()
    await client.post(
        f"/api/v1/tasks/{task['id']}/time-entries",
        json={"hours": "3", "work_date": TODAY},
        headers=admin_headers,
    )
    return project_id, task


class TestProjectReport:
    async def test_summarises_tasks_and_hours(
        self, client, admin_headers, valid_project_payload, admin_user
    ):
        project_id, _ = await _project_with_work(
            client, admin_headers, valid_project_payload, admin_user
        )

        response = await client.get(
            f"/api/v1/projects/{project_id}/report", headers=admin_headers
        )

        assert response.status_code == 200, response.text
        body = response.json()
        assert body["total_tareas"] == 1
        assert float(body["horas_estimadas"]) == 8
        assert float(body["horas_dedicadas"]) == 3
        assert body["tareas_por_estado"]["pendiente_por_iniciar"] == 1

    async def test_each_row_carries_its_context(
        self, client, admin_headers, valid_project_payload, admin_user
    ):
        """Un informe sin el elemento ni el responsable obliga a cruzarlo a mano
        con otra pantalla, que es justo lo que se quiere evitar."""
        project_id, _ = await _project_with_work(
            client, admin_headers, valid_project_payload, admin_user
        )

        row = (
            await client.get(
                f"/api/v1/projects/{project_id}/report", headers=admin_headers
            )
        ).json()["filas"][0]

        assert row["elemento"] == "Unidad 1"
        assert row["tarea"] == "Grabar video"
        assert row["responsable"]
        assert float(row["horas_dedicadas"]) == 3

    async def test_breaks_down_hours_by_person(
        self, client, admin_headers, valid_project_payload, admin_user
    ):
        project_id, _ = await _project_with_work(
            client, admin_headers, valid_project_payload, admin_user
        )

        people = (
            await client.get(
                f"/api/v1/projects/{project_id}/report", headers=admin_headers
            )
        ).json()["horas_por_persona"]

        assert len(people) == 1
        assert float(people[0]["horas"]) == 3

    async def test_empty_project_reports_zeroes(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)

        body = (
            await client.get(
                f"/api/v1/projects/{project_id}/report", headers=admin_headers
            )
        ).json()

        assert body["total_tareas"] == 0
        assert body["filas"] == []
        assert float(body["horas_dedicadas"]) == 0

    async def test_unknown_project_is_404(self, client, admin_headers):
        response = await client.get(
            "/api/v1/projects/00000000-0000-0000-0000-000000000000/report",
            headers=admin_headers,
        )
        assert response.status_code == 404

    async def test_regular_user_cannot_read_the_report(
        self, client, admin_headers, member_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        response = await client.get(
            f"/api/v1/projects/{project_id}/report", headers=member_headers
        )
        assert response.status_code == 403


class TestCsvExport:
    async def test_downloads_as_a_csv_attachment(
        self, client, admin_headers, valid_project_payload, admin_user
    ):
        project_id, _ = await _project_with_work(
            client, admin_headers, valid_project_payload, admin_user
        )

        response = await client.get(
            f"/api/v1/projects/{project_id}/report.csv", headers=admin_headers
        )

        assert response.status_code == 200, response.text
        assert "text/csv" in response.headers["content-type"]
        assert "attachment" in response.headers["content-disposition"]
        assert ".csv" in response.headers["content-disposition"]

    async def test_opens_correctly_in_spanish_excel(
        self, client, admin_headers, valid_project_payload, admin_user
    ):
        """BOM + separador `;` + coma decimal: sin esto, Excel en español lo
        vuelca todo en una columna y trata "2.5" como texto."""
        project_id, _ = await _project_with_work(
            client, admin_headers, valid_project_payload, admin_user
        )

        text = (
            await client.get(
                f"/api/v1/projects/{project_id}/report.csv", headers=admin_headers
            )
        ).text

        assert text.startswith("﻿")
        header = text.splitlines()[0]
        assert header.count(";") == 9
        assert "3,00" in text  # horas dedicadas con coma decimal

    async def test_includes_a_row_per_task(
        self, client, admin_headers, valid_project_payload, admin_user
    ):
        project_id, _ = await _project_with_work(
            client, admin_headers, valid_project_payload, admin_user
        )

        text = (
            await client.get(
                f"/api/v1/projects/{project_id}/report.csv", headers=admin_headers
            )
        ).text

        lines = [line for line in text.splitlines() if line.strip()]
        assert len(lines) == 2  # cabecera + una tarea
        assert "Grabar video" in lines[1]
        assert "Unidad 1" in lines[1]

    async def test_regular_user_cannot_export(
        self, client, admin_headers, member_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        response = await client.get(
            f"/api/v1/projects/{project_id}/report.csv", headers=member_headers
        )
        assert response.status_code == 403
