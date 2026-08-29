from app.modules.teams.infrastructure.enums import TeamRole
from tests.integration.worktree.test_routes import _create_project


async def _create_user(
    client,
    admin_headers,
    *,
    email: str,
    name: str = "Ana",
    last_name: str = "Gomez",
    project_id: str | None = None,
):
    response = await client.post(
        "/api/v1/identity/users",
        json={
            "email": email,
            "password": "password123",
            "name": name,
            "last_name": last_name,
            "role": "user",
            "position": "desarrollador",
        },
        headers=admin_headers,
    )
    assert response.status_code == 201, response.text
    user = response.json()
    # Un integrante de equipo debe ser antes integrante del proyecto.
    if project_id is not None:
        member = await client.post(
            "/api/v1/projects/members/",
            json={
                "user_id": user["id"],
                "project_id": project_id,
                "project_role": "integrante",
            },
            headers=admin_headers,
        )
        assert member.status_code == 201, member.text
    return user


async def _create_team(
    client, admin_headers, project_id, *, name="Equipo de Desarrollo"
):
    response = await client.post(
        f"/api/v1/projects/{project_id}/teams",
        json={"name": name, "description": "Equipo del proyecto"},
        headers=admin_headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


class TestTeamCrudRoutes:
    async def test_should_create_team(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        team = await _create_team(client, admin_headers, project_id)

        assert team["name"] == "Equipo de Desarrollo"
        assert team["description"] == "Equipo del proyecto"
        assert team["project_id"] == project_id
        assert team["member_count"] == 0

    async def test_should_reject_duplicate_team_name_in_same_project(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        await _create_team(client, admin_headers, project_id, name="Diseño")

        duplicate = await client.post(
            f"/api/v1/projects/{project_id}/teams",
            json={"name": "Diseño"},
            headers=admin_headers,
        )

        assert duplicate.status_code == 409

    async def test_should_allow_same_team_name_in_different_projects(
        self, client, admin_headers, valid_project_payload
    ):
        project_a = await _create_project(client, admin_headers, valid_project_payload)
        project_b = await _create_project(client, admin_headers, valid_project_payload)

        await _create_team(client, admin_headers, project_a, name="Diseño")
        second = await client.post(
            f"/api/v1/projects/{project_b}/teams",
            json={"name": "Diseño"},
            headers=admin_headers,
        )

        assert second.status_code == 201, second.text

    async def test_list_my_teams_returns_only_membership(
        self, client, admin_headers, valid_project_payload
    ):
        """GET /teams/mine: el rol User solo ve los equipos a los que pertenece."""
        from app.core.security import create_access_token

        project_id = await _create_project(client, admin_headers, valid_project_payload)
        team_a = await _create_team(client, admin_headers, project_id, name="Alfa")
        await _create_team(client, admin_headers, project_id, name="Beta")

        user = await _create_user(
            client, admin_headers, email="mine@test.com", project_id=project_id
        )
        add = await client.post(
            f"/api/v1/projects/{project_id}/teams/{team_a['id']}/members",
            json={"user_id": user["id"]},
            headers=admin_headers,
        )
        assert add.status_code == 201, add.text

        headers = {
            "Authorization": (
                f"Bearer {create_access_token(user_id=user['id'], role='user')}"
            )
        }
        resp = await client.get(
            f"/api/v1/projects/{project_id}/teams/mine", headers=headers
        )
        assert resp.status_code == 200, resp.text
        assert [t["name"] for t in resp.json()] == ["Alfa"]

    async def test_should_forbid_non_admin_creating_team(
        self, client, member_headers, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)

        response = await client.post(
            f"/api/v1/projects/{project_id}/teams",
            json={"name": "Equipo No Autorizado"},
            headers=member_headers,
        )

        assert response.status_code == 403

    async def test_should_list_teams_paginated(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        await _create_team(client, admin_headers, project_id, name="Equipo A")
        await _create_team(client, admin_headers, project_id, name="Equipo B")

        response = await client.get(
            f"/api/v1/projects/{project_id}/teams?page=1&page_size=10",
            headers=admin_headers,
        )

        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 2
        assert body["page"] == 1
        assert {t["name"] for t in body["items"]} == {"Equipo A", "Equipo B"}

    async def test_should_not_list_teams_from_other_projects(
        self, client, admin_headers, valid_project_payload
    ):
        project_a = await _create_project(client, admin_headers, valid_project_payload)
        project_b = await _create_project(client, admin_headers, valid_project_payload)
        await _create_team(client, admin_headers, project_a, name="Equipo A")
        await _create_team(client, admin_headers, project_b, name="Equipo B")

        response = await client.get(
            f"/api/v1/projects/{project_a}/teams", headers=admin_headers
        )

        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 1
        assert body["items"][0]["name"] == "Equipo A"

    async def test_should_search_teams_by_name(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        await _create_team(
            client, admin_headers, project_id, name="Equipo de Desarrollo"
        )
        await _create_team(client, admin_headers, project_id, name="Equipo de Diseño")

        response = await client.get(
            f"/api/v1/projects/{project_id}/teams?search=Desarrollo",
            headers=admin_headers,
        )

        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 1
        assert body["items"][0]["name"] == "Equipo de Desarrollo"

    async def test_should_update_team(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        team = await _create_team(client, admin_headers, project_id)

        response = await client.patch(
            f"/api/v1/projects/{project_id}/teams/{team['id']}",
            json={"name": "Equipo Renombrado"},
            headers=admin_headers,
        )

        assert response.status_code == 200
        assert response.json()["name"] == "Equipo Renombrado"

    async def test_should_soft_delete_team(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        team = await _create_team(client, admin_headers, project_id)

        delete_response = await client.delete(
            f"/api/v1/projects/{project_id}/teams/{team['id']}",
            headers=admin_headers,
        )
        assert delete_response.status_code == 204

        get_response = await client.get(
            f"/api/v1/projects/{project_id}/teams/{team['id']}",
            headers=admin_headers,
        )
        assert get_response.status_code == 404


class TestTeamMemberRoutes:
    async def test_should_add_member_with_default_role(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        team = await _create_team(client, admin_headers, project_id)
        user = await _create_user(
            client, admin_headers, email="ana@example.com", project_id=project_id
        )

        response = await client.post(
            f"/api/v1/projects/{project_id}/teams/{team['id']}/members",
            json={"user_id": user["id"]},
            headers=admin_headers,
        )

        assert response.status_code == 201, response.text
        member = response.json()
        assert member["user_id"] == user["id"]
        assert member["team_role"] == TeamRole.INTEGRANTE.value
        assert member["name"] == "Ana"

    async def test_should_add_member_with_explicit_role(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        team = await _create_team(client, admin_headers, project_id)
        user = await _create_user(
            client,
            admin_headers,
            email="lider@example.com",
            name="Luis",
            project_id=project_id,
        )

        response = await client.post(
            f"/api/v1/projects/{project_id}/teams/{team['id']}/members",
            json={"user_id": user["id"], "team_role": TeamRole.LIDER.value},
            headers=admin_headers,
        )

        assert response.status_code == 201
        assert response.json()["team_role"] == TeamRole.LIDER.value

    async def test_should_reject_duplicate_member(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        team = await _create_team(client, admin_headers, project_id)
        user = await _create_user(
            client, admin_headers, email="dup@example.com", project_id=project_id
        )

        await client.post(
            f"/api/v1/projects/{project_id}/teams/{team['id']}/members",
            json={"user_id": user["id"]},
            headers=admin_headers,
        )
        duplicate = await client.post(
            f"/api/v1/projects/{project_id}/teams/{team['id']}/members",
            json={"user_id": user["id"]},
            headers=admin_headers,
        )

        assert duplicate.status_code == 409

    async def test_should_reject_member_with_unknown_user(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        team = await _create_team(client, admin_headers, project_id)

        response = await client.post(
            f"/api/v1/projects/{project_id}/teams/{team['id']}/members",
            json={"user_id": "00000000-0000-0000-0000-000000000000"},
            headers=admin_headers,
        )

        assert response.status_code == 404

    async def test_should_reject_member_not_in_project(
        self, client, admin_headers, valid_project_payload
    ):
        """Un equipo vive dentro de un proyecto: no se puede entrar a un equipo
        sin ser antes integrante del proyecto (evita miembros indirectos)."""
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        team = await _create_team(client, admin_headers, project_id)
        # Usuario que existe pero NO se ha dado de alta en el proyecto.
        user = await _create_user(client, admin_headers, email="outsider@example.com")

        response = await client.post(
            f"/api/v1/projects/{project_id}/teams/{team['id']}/members",
            json={"user_id": user["id"]},
            headers=admin_headers,
        )

        assert response.status_code == 409, response.text

    async def test_should_change_member_role(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        team = await _create_team(client, admin_headers, project_id)
        user = await _create_user(
            client, admin_headers, email="role@example.com", project_id=project_id
        )

        await client.post(
            f"/api/v1/projects/{project_id}/teams/{team['id']}/members",
            json={"user_id": user["id"]},
            headers=admin_headers,
        )

        response = await client.patch(
            f"/api/v1/projects/{project_id}/teams/{team['id']}/members/{user['id']}",
            json={"team_role": TeamRole.SUPERVISOR.value},
            headers=admin_headers,
        )

        assert response.status_code == 200
        assert response.json()["team_role"] == TeamRole.SUPERVISOR.value

    async def test_should_remove_member(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        team = await _create_team(client, admin_headers, project_id)
        user = await _create_user(
            client, admin_headers, email="remove@example.com", project_id=project_id
        )

        await client.post(
            f"/api/v1/projects/{project_id}/teams/{team['id']}/members",
            json={"user_id": user["id"]},
            headers=admin_headers,
        )

        remove_response = await client.delete(
            f"/api/v1/projects/{project_id}/teams/{team['id']}/members/{user['id']}",
            headers=admin_headers,
        )
        assert remove_response.status_code == 204

        list_response = await client.get(
            f"/api/v1/projects/{project_id}/teams/{team['id']}/members",
            headers=admin_headers,
        )
        assert list_response.status_code == 200
        assert list_response.json() == []

    async def test_should_list_members(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        team = await _create_team(client, admin_headers, project_id)
        user1 = await _create_user(
            client,
            admin_headers,
            email="m1@example.com",
            name="Ana",
            project_id=project_id,
        )
        user2 = await _create_user(
            client,
            admin_headers,
            email="m2@example.com",
            name="Carlos",
            project_id=project_id,
        )

        for user in (user1, user2):
            await client.post(
                f"/api/v1/projects/{project_id}/teams/{team['id']}/members",
                json={"user_id": user["id"]},
                headers=admin_headers,
            )

        response = await client.get(
            f"/api/v1/projects/{project_id}/teams/{team['id']}/members",
            headers=admin_headers,
        )

        assert response.status_code == 200
        names = {m["name"] for m in response.json()}
        assert names == {"Ana", "Carlos"}

    async def test_member_count_reflects_members(
        self, client, admin_headers, valid_project_payload
    ):
        project_id = await _create_project(client, admin_headers, valid_project_payload)
        team = await _create_team(client, admin_headers, project_id)
        user = await _create_user(
            client, admin_headers, email="count@example.com", project_id=project_id
        )

        await client.post(
            f"/api/v1/projects/{project_id}/teams/{team['id']}/members",
            json={"user_id": user["id"]},
            headers=admin_headers,
        )

        response = await client.get(
            f"/api/v1/projects/{project_id}/teams/{team['id']}",
            headers=admin_headers,
        )

        assert response.status_code == 200
        assert response.json()["member_count"] == 1
