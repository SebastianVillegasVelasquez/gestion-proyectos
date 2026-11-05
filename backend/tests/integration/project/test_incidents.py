"""Bitácora de incidentes de un proyecto: flujo completo contra la API.

crear proyecto → registrar incidente → adjuntar evidencia → reflejar el atraso
en el cronograma → revertirlo.
"""

from datetime import date, timedelta


async def _create_project(client, admin_headers, valid_project_payload) -> dict:
    resp = await client.post(
        "/api/v1/projects/", json=valid_project_payload, headers=admin_headers
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _incident_payload(**overrides) -> dict:
    return {
        "title": "Sin acceso SSH al servidor",
        "responsible": "cliente",
        "incident_date": date.today().isoformat(),
        "impact_days": 2,
        **overrides,
    }


class TestProjectIncidents:
    async def test_register_apply_and_revert_moves_the_end_date(
        self, client, admin_headers, valid_project_payload
    ):
        project = await _create_project(client, admin_headers, valid_project_payload)
        base = f"/api/v1/projects/{project['id']}/incidents"

        created = await client.post(
            base, json=_incident_payload(), headers=admin_headers
        )
        assert created.status_code == 201, created.text
        incident_id = created.json()["id"]

        # Registrar NO mueve el cronograma.
        current = await client.get(
            f"/api/v1/projects/{project['id']}", headers=admin_headers
        )
        assert current.json()["end_date"] == project["end_date"]

        applied = await client.post(
            f"{base}/{incident_id}/apply", headers=admin_headers
        )
        assert applied.status_code == 200, applied.text
        assert applied.json()["is_applied"] is True

        shifted = await client.get(
            f"/api/v1/projects/{project['id']}", headers=admin_headers
        )
        expected = date.fromisoformat(project["end_date"]) + timedelta(days=2)
        assert shifted.json()["end_date"] == expected.isoformat()

        reverted = await client.post(
            f"{base}/{incident_id}/revert", headers=admin_headers
        )
        assert reverted.status_code == 200, reverted.text
        restored = await client.get(
            f"/api/v1/projects/{project['id']}", headers=admin_headers
        )
        assert restored.json()["end_date"] == project["end_date"]

    async def test_evidence_upload_and_view(
        self, client, admin_headers, valid_project_payload
    ):
        project = await _create_project(client, admin_headers, valid_project_payload)
        base = f"/api/v1/projects/{project['id']}/incidents"
        incident_id = (
            await client.post(base, json=_incident_payload(), headers=admin_headers)
        ).json()["id"]

        uploaded = await client.post(
            f"{base}/{incident_id}/attachments",
            files={"file": ("captura.png", b"\x89PNG-fake", "image/png")},
            headers=admin_headers,
        )
        assert uploaded.status_code == 201, uploaded.text
        attachment = uploaded.json()["attachments"][0]
        assert attachment["name"] == "captura.png"

        viewed = await client.get(
            f"{base}/{incident_id}/attachments/{attachment['id']}/view",
            headers=admin_headers,
        )
        assert viewed.status_code == 200
        assert viewed.content == b"\x89PNG-fake"

    async def test_regular_users_cannot_read_the_log(
        self, client, admin_headers, member_headers, valid_project_payload
    ):
        project = await _create_project(client, admin_headers, valid_project_payload)
        resp = await client.get(
            f"/api/v1/projects/{project['id']}/incidents", headers=member_headers
        )
        assert resp.status_code == 403
