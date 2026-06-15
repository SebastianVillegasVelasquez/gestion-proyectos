from uuid import uuid4


async def _create_project(client, admin_headers) -> str:
    payload = {
        "name": "Proyecto con fases",
        "description": "Proyecto de prueba",
        "client_name": "Cliente",
        "start_date": "2026-07-01",
        "end_date": "2026-12-31",
    }
    res = await client.post("/api/v1/projects/", json=payload, headers=admin_headers)
    assert res.status_code == 201
    return res.json()["id"]


class TestCreatePhaseRoute:
    async def test_should_create_phase_with_incremental_order(
        self, client, admin_headers
    ):
        project_id = await _create_project(client, admin_headers)

        first = await client.post(
            f"/api/v1/projects/{project_id}/phases",
            json={"name": "Planeación"},
            headers=admin_headers,
        )
        second = await client.post(
            f"/api/v1/projects/{project_id}/phases",
            json={"name": "Producción", "duration_days": 15},
            headers=admin_headers,
        )

        assert first.status_code == 201
        assert second.status_code == 201
        assert first.json()["order_index"] == 0
        assert second.json()["order_index"] == 1
        assert second.json()["duration_days"] == 15

    async def test_should_404_when_project_missing(self, client, admin_headers):
        res = await client.post(
            f"/api/v1/projects/{uuid4()}/phases",
            json={"name": "Fase"},
            headers=admin_headers,
        )
        assert res.status_code == 404

    async def test_should_422_when_end_before_start(self, client, admin_headers):
        project_id = await _create_project(client, admin_headers)
        res = await client.post(
            f"/api/v1/projects/{project_id}/phases",
            json={"name": "Fase", "start_date": "2026-08-10", "end_date": "2026-08-01"},
            headers=admin_headers,
        )
        assert res.status_code == 422

    async def test_should_forbid_regular_user(self, client, member_headers):
        res = await client.post(
            f"/api/v1/projects/{uuid4()}/phases",
            json={"name": "Fase"},
            headers=member_headers,
        )
        assert res.status_code == 403


class TestListPhasesRoute:
    async def test_should_return_phases_ordered(self, client, admin_headers):
        project_id = await _create_project(client, admin_headers)
        for name in ["Fase A", "Fase B", "Fase C"]:
            await client.post(
                f"/api/v1/projects/{project_id}/phases",
                json={"name": name},
                headers=admin_headers,
            )

        res = await client.get(
            f"/api/v1/projects/{project_id}/phases", headers=admin_headers
        )

        assert res.status_code == 200
        body = res.json()
        assert [p["order_index"] for p in body] == [0, 1, 2]
        assert [p["name"] for p in body] == ["Fase A", "Fase B", "Fase C"]

    async def test_should_allow_regular_user_to_read(
        self, client, admin_headers, member_headers
    ):
        project_id = await _create_project(client, admin_headers)
        await client.post(
            f"/api/v1/projects/{project_id}/phases",
            json={"name": "Fase"},
            headers=admin_headers,
        )

        res = await client.get(
            f"/api/v1/projects/{project_id}/phases", headers=member_headers
        )
        assert res.status_code == 200
        assert len(res.json()) == 1


class TestUpdateAndDeletePhaseRoute:
    async def test_should_update_phase_dates(self, client, admin_headers):
        project_id = await _create_project(client, admin_headers)
        created = await client.post(
            f"/api/v1/projects/{project_id}/phases",
            json={"name": "Fase 1"},
            headers=admin_headers,
        )
        phase_id = created.json()["id"]

        res = await client.patch(
            f"/api/v1/projects/{project_id}/phases/{phase_id}",
            json={"name": "Fase 1 editada", "start_date": "2026-09-01"},
            headers=admin_headers,
        )

        assert res.status_code == 200
        assert res.json()["name"] == "Fase 1 editada"
        assert res.json()["start_date"] == "2026-09-01"

    async def test_should_delete_phase(self, client, admin_headers):
        project_id = await _create_project(client, admin_headers)
        created = await client.post(
            f"/api/v1/projects/{project_id}/phases",
            json={"name": "Fase 1"},
            headers=admin_headers,
        )
        phase_id = created.json()["id"]

        res = await client.delete(
            f"/api/v1/projects/{project_id}/phases/{phase_id}",
            headers=admin_headers,
        )
        assert res.status_code == 204

        listing = await client.get(
            f"/api/v1/projects/{project_id}/phases", headers=admin_headers
        )
        assert listing.json() == []

    async def test_should_404_deleting_unknown_phase(self, client, admin_headers):
        project_id = await _create_project(client, admin_headers)
        res = await client.delete(
            f"/api/v1/projects/{project_id}/phases/{uuid4()}",
            headers=admin_headers,
        )
        assert res.status_code == 404
