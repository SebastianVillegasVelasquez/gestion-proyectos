from app.modules.project.infrastructure.enums import ProjectRole


class TestRoutesProjectMember:
    async def test_should_add_member_to_project(
        self,
        client,
        admin_headers,
        valid_project_payload,
    ):
        project_response = await client.post(
            "/api/v1/projects/",
            json=valid_project_payload,
            headers=admin_headers,
        )

        assert project_response.status_code == 201

        user_response = await client.post(
            "/api/v1/identity/users",
            json={
                "email": "admin@example.com",
                "password": "password123",
                "name": "John",
                "last_name": "Doe",
                "role": "admin",
                "position": "desarrollador",
            },
            headers=admin_headers,
        )

        assert user_response.status_code == 201

        project = project_response.json()
        user = user_response.json()

        member_response = await client.post(
            "/api/v1/projects/members/",
            json={
                "user_id": user["id"],
                "project_id": project["id"],
                "project_role": ProjectRole.INTEGRANTE.value,
            },
            headers=admin_headers,
        )

        assert member_response.status_code == 201

        member = member_response.json()

        assert member["user_id"] == user["id"]
        assert member["project_role"] == "integrante"
        assert member["name"] == user["name"]

    async def test_should_get_all_members_from_project(
        self,
        client,
        admin_headers,
        valid_project_payload,
    ):
        project_response = await client.post(
            "/api/v1/projects/",
            json=valid_project_payload,
            headers=admin_headers,
        )
        assert project_response.status_code == 201
        project = project_response.json()

        user1_response = await client.post(
            "/api/v1/identity/users",
            json={
                "email": "ana.gomez@example.com",
                "password": "password123",
                "name": "Ana",
                "last_name": "Gomez",
                "role": "user",
                "position": "desarrollador",
            },
            headers=admin_headers,
        )
        user2_response = await client.post(
            "/api/v1/identity/users",
            json={
                "email": "carlos.perez@example.com",
                "password": "password123",
                "name": "Carlos",
                "last_name": "Perez",
                "role": "user",
                "position": "desarrollador",
            },
            headers=admin_headers,
        )
        assert user1_response.status_code == 201
        assert user2_response.status_code == 201

        user1 = user1_response.json()
        user2 = user2_response.json()

        await client.post(
            "/api/v1/projects/members/",
            json={
                "user_id": user1["id"],
                "project_id": project["id"],
                "project_role": ProjectRole.INTEGRANTE.value,
            },
            headers=admin_headers,
        )
        await client.post(
            "/api/v1/projects/members/",
            json={
                "user_id": user2["id"],
                "project_id": project["id"],
                "project_role": ProjectRole.COORDINADOR.value,
            },
            headers=admin_headers,
        )

        members_response = await client.get(
            f"/api/v1/projects/{project['id']}/members",
            headers=admin_headers,
        )

        assert members_response.status_code == 200

        members = members_response.json()

        assert len(members) == 2

        retrieved_names = [m["name"] for m in members]
        retrieved_roles = [m["project_role"] for m in members]

        assert "Ana" in retrieved_names
        assert "Carlos" in retrieved_names
        assert "integrante" in retrieved_roles
        assert "coordinador" in retrieved_roles
