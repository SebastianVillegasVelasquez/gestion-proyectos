from uuid import uuid4


async def _create_project(client, admin_headers) -> str:
    res = await client.post(
        "/api/v1/projects/",
        json={
            "name": "Proyecto con nodos",
            "description": "Proyecto de prueba",
            "client_name": "Cliente",
        },
        headers=admin_headers,
    )
    assert res.status_code == 201
    return res.json()["id"]


async def _create_phase(client, admin_headers, project_id: str) -> str:
    res = await client.post(
        f"/api/v1/projects/{project_id}/phases",
        json={"name": "Fase 1"},
        headers=admin_headers,
    )
    assert res.status_code == 201
    return res.json()["id"]


class TestCreateNodeRoute:
    async def test_should_create_node_with_phase_label_and_end_date(
        self, client, admin_headers
    ):
        project_id = await _create_project(client, admin_headers)
        phase_id = await _create_phase(client, admin_headers, project_id)

        res = await client.post(
            "/api/v1/projects/nodes",
            json={
                "name": "Curso de Python",
                "node_type": "MODULO",
                "project_id": project_id,
                "phase_id": phase_id,
                "type_label": "Unidad",
                "end_date": "2026-09-30",
            },
            headers=admin_headers,
        )

        assert res.status_code == 201
        body = res.json()
        assert body["type_label"] == "Unidad"
        assert body["phase_id"] == phase_id
        assert body["end_date"] == "2026-09-30"

    async def test_should_404_when_phase_belongs_to_other_project(
        self, client, admin_headers
    ):
        project_a = await _create_project(client, admin_headers)
        project_b = await _create_project(client, admin_headers)
        phase_b = await _create_phase(client, admin_headers, project_b)

        res = await client.post(
            "/api/v1/projects/nodes",
            json={
                "name": "Programa",
                "node_type": "PROGRAMA",
                "project_id": project_a,
                "phase_id": phase_b,
            },
            headers=admin_headers,
        )
        assert res.status_code == 404


class TestListNodesRoute:
    async def test_should_list_project_nodes(self, client, admin_headers):
        project_id = await _create_project(client, admin_headers)
        for name in ["Programa", "Curso"]:
            await client.post(
                "/api/v1/projects/nodes",
                json={
                    "name": name,
                    "node_type": "PROGRAMA",
                    "project_id": project_id,
                },
                headers=admin_headers,
            )

        res = await client.get(
            f"/api/v1/projects/{project_id}/nodes", headers=admin_headers
        )
        assert res.status_code == 200
        assert len(res.json()) == 2

    async def test_should_404_for_unknown_project(self, client, admin_headers):
        res = await client.get(
            f"/api/v1/projects/{uuid4()}/nodes", headers=admin_headers
        )
        assert res.status_code == 404


class TestUpdateNodeRoute:
    async def test_should_update_node_label(self, client, admin_headers):
        project_id = await _create_project(client, admin_headers)
        created = await client.post(
            "/api/v1/projects/nodes",
            json={
                "name": "Modulo 1",
                "node_type": "MODULO",
                "project_id": project_id,
            },
            headers=admin_headers,
        )
        node_id = created.json()["id"]

        res = await client.patch(
            f"/api/v1/projects/{project_id}/nodes/{node_id}",
            json={"type_label": "Corte", "end_date": "2026-11-01"},
            headers=admin_headers,
        )

        assert res.status_code == 200
        assert res.json()["type_label"] == "Corte"
        assert res.json()["end_date"] == "2026-11-01"
