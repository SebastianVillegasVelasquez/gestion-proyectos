from uuid import uuid4


class TestProjectRoutes:
    async def test_should_create_project(
        self, client, admin_headers, valid_project_payload
    ):
        response = await client.post(
            "/api/v1/projects/", json=valid_project_payload, headers=admin_headers
        )

        assert response.status_code == 201
        assert response.json()["name"] == "Test Project"
        assert response.json()["description"] == "This is a test project"
        assert response.json()["start_date"] == "2026-07-01"
        assert response.json()["end_date"] == "2026-12-31"

        persisted_project = await client.get(
            f"/api/v1/projects/{response.json()['id']}", headers=admin_headers
        )

        assert persisted_project.status_code == 200
        assert persisted_project.json()["name"] == "Test Project"

    async def test_should_get_all_projects(
        self, client, admin_headers, valid_project_payload
    ):
        await client.post(
            "/api/v1/projects/", json=valid_project_payload, headers=admin_headers
        )
        await client.post(
            "/api/v1/projects/", json=valid_project_payload, headers=admin_headers
        )

        response = await client.get("/api/v1/projects/", headers=admin_headers)

        assert response.status_code == 200
        assert isinstance(response.json(), list)
        assert len(response.json()) >= 2

    async def test_should_get_project_by_id(
        self, client, admin_headers, valid_project_payload
    ):
        create_response = await client.post(
            "/api/v1/projects/", json=valid_project_payload, headers=admin_headers
        )
        project_id = create_response.json()["id"]

        response = await client.get(
            f"/api/v1/projects/{project_id}", headers=admin_headers
        )

        assert response.status_code == 200
        assert response.json()["id"] == project_id
        assert response.json()["name"] == valid_project_payload["name"]

    async def test_should_return_404_when_getting_nonexistent_project(
        self, client, admin_headers
    ):
        random_id = str(uuid4())
        response = await client.get(
            f"/api/v1/projects/{random_id}", headers=admin_headers
        )

        assert response.status_code == 404

    async def test_should_update_project(
        self, client, admin_headers, valid_project_payload
    ):
        create_response = await client.post(
            "/api/v1/projects/", json=valid_project_payload, headers=admin_headers
        )
        project_id = create_response.json()["id"]

        update_payload = {
            "name": "Updated Project Name",
            "client_name": "Updated Client",
        }

        response = await client.patch(
            f"/api/v1/projects/{project_id}", json=update_payload, headers=admin_headers
        )

        assert response.status_code == 200
        assert response.json()["id"] == project_id
        assert response.json()["name"] == "Updated Project Name"
        assert response.json()["client_name"] == "Updated Client"
        assert response.json()["description"] == valid_project_payload["description"]

    async def test_should_delete_project(
        self, client, admin_headers, super_admin_headers, valid_project_payload
    ):
        create_response = await client.post(
            "/api/v1/projects/", json=valid_project_payload, headers=admin_headers
        )
        project_id = create_response.json()["id"]

        delete_response = await client.delete(
            f"/api/v1/projects/{project_id}", headers=super_admin_headers
        )

        assert delete_response.status_code == 204

        get_response = await client.get(
            f"/api/v1/projects/{project_id}", headers=admin_headers
        )
        assert get_response.status_code == 404

    async def test_should_create_single_project_node(
        self, client, admin_headers, valid_project_payload
    ):
        create_response = await client.post(
            "/api/v1/projects/", json=valid_project_payload, headers=admin_headers
        )
        project_id = create_response.json()["id"]

        node_payload = {
            "name": "Programa Raíz",
            "node_type": "PROGRAMA",
            "project_id": project_id,
        }

        response = await client.post(
            "/api/v1/projects/nodes", json=node_payload, headers=admin_headers
        )

        assert response.status_code == 201
        assert response.json()["name"] == "Programa Raíz"
        assert response.json()["node_type"] == "PROGRAMA"
        assert response.json()["project_id"] == project_id
        assert response.json()["parent_id"] is None

    async def test_should_create_project_node_chain(
        self, client, admin_headers, valid_project_payload
    ):
        create_response = await client.post(
            "/api/v1/projects/", json=valid_project_payload, headers=admin_headers
        )
        project_id = create_response.json()["id"]

        chain_payload = [
            {
                "name": "Programa Principal",
                "node_type": "PROGRAMA",
                "project_id": project_id,
            },
            {"name": "Curso 1", "node_type": "CURSO", "project_id": project_id},
            {"name": "Módulo 1", "node_type": "MODULO", "project_id": project_id},
        ]

        response = await client.post(
            "/api/v1/projects/nodes", json=chain_payload, headers=admin_headers
        )

        assert response.status_code == 201
        assert isinstance(response.json(), list)
        assert len(response.json()) == 3

        nodes = response.json()
        assert nodes[0]["parent_id"] is None
        assert nodes[1]["parent_id"] == nodes[0]["id"]
        assert nodes[2]["parent_id"] == nodes[1]["id"]
