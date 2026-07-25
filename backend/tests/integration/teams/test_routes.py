from app.modules.teams.infrastructure.enums import TeamRole


async def _create_user(
    client, admin_headers, *, email: str, name: str = "Ana", last_name: str = "Gomez"
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
    return response.json()


async def _create_team(client, admin_headers, *, name="Equipo de Desarrollo"):
    response = await client.post(
        "/api/v1/teams/",
        json={"name": name, "description": "Equipo predefinido"},
        headers=admin_headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


class TestTeamCrudRoutes:
    async def test_should_create_team(self, client, admin_headers):
        team = await _create_team(client, admin_headers)

        assert team["name"] == "Equipo de Desarrollo"
        assert team["description"] == "Equipo predefinido"
        assert team["member_count"] == 0

    async def test_should_reject_duplicate_team_name(self, client, admin_headers):
        await _create_team(client, admin_headers, name="Diseño")

        duplicate = await client.post(
            "/api/v1/teams/",
            json={"name": "Diseño"},
            headers=admin_headers,
        )

        assert duplicate.status_code == 409

    async def test_should_forbid_non_admin_creating_team(self, client, member_headers):
        response = await client.post(
            "/api/v1/teams/",
            json={"name": "Equipo No Autorizado"},
            headers=member_headers,
        )

        assert response.status_code == 403

    async def test_should_list_teams_paginated(self, client, admin_headers):
        await _create_team(client, admin_headers, name="Equipo A")
        await _create_team(client, admin_headers, name="Equipo B")

        response = await client.get(
            "/api/v1/teams/?page=1&page_size=10",
            headers=admin_headers,
        )

        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 2
        assert body["page"] == 1
        assert {t["name"] for t in body["items"]} == {"Equipo A", "Equipo B"}

    async def test_should_search_teams_by_name(self, client, admin_headers):
        await _create_team(client, admin_headers, name="Equipo de Desarrollo")
        await _create_team(client, admin_headers, name="Equipo de Diseño")

        response = await client.get(
            "/api/v1/teams/?search=Desarrollo",
            headers=admin_headers,
        )

        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 1
        assert body["items"][0]["name"] == "Equipo de Desarrollo"

    async def test_should_update_team(self, client, admin_headers):
        team = await _create_team(client, admin_headers)

        response = await client.patch(
            f"/api/v1/teams/{team['id']}",
            json={"name": "Equipo Renombrado"},
            headers=admin_headers,
        )

        assert response.status_code == 200
        assert response.json()["name"] == "Equipo Renombrado"

    async def test_should_soft_delete_team(self, client, admin_headers):
        team = await _create_team(client, admin_headers)

        delete_response = await client.delete(
            f"/api/v1/teams/{team['id']}",
            headers=admin_headers,
        )
        assert delete_response.status_code == 204

        get_response = await client.get(
            f"/api/v1/teams/{team['id']}",
            headers=admin_headers,
        )
        assert get_response.status_code == 404


class TestTeamMemberRoutes:
    async def test_should_add_member_with_default_role(self, client, admin_headers):
        team = await _create_team(client, admin_headers)
        user = await _create_user(client, admin_headers, email="ana@example.com")

        response = await client.post(
            f"/api/v1/teams/{team['id']}/members",
            json={"user_id": user["id"]},
            headers=admin_headers,
        )

        assert response.status_code == 201, response.text
        member = response.json()
        assert member["user_id"] == user["id"]
        assert member["team_role"] == TeamRole.INTEGRANTE.value
        assert member["name"] == "Ana"

    async def test_should_add_member_with_explicit_role(self, client, admin_headers):
        team = await _create_team(client, admin_headers)
        user = await _create_user(
            client, admin_headers, email="lider@example.com", name="Luis"
        )

        response = await client.post(
            f"/api/v1/teams/{team['id']}/members",
            json={"user_id": user["id"], "team_role": TeamRole.LIDER.value},
            headers=admin_headers,
        )

        assert response.status_code == 201
        assert response.json()["team_role"] == TeamRole.LIDER.value

    async def test_should_reject_duplicate_member(self, client, admin_headers):
        team = await _create_team(client, admin_headers)
        user = await _create_user(client, admin_headers, email="dup@example.com")

        await client.post(
            f"/api/v1/teams/{team['id']}/members",
            json={"user_id": user["id"]},
            headers=admin_headers,
        )
        duplicate = await client.post(
            f"/api/v1/teams/{team['id']}/members",
            json={"user_id": user["id"]},
            headers=admin_headers,
        )

        assert duplicate.status_code == 409

    async def test_should_reject_member_with_unknown_user(self, client, admin_headers):
        team = await _create_team(client, admin_headers)

        response = await client.post(
            f"/api/v1/teams/{team['id']}/members",
            json={"user_id": "00000000-0000-0000-0000-000000000000"},
            headers=admin_headers,
        )

        assert response.status_code == 404

    async def test_should_change_member_role(self, client, admin_headers):
        team = await _create_team(client, admin_headers)
        user = await _create_user(client, admin_headers, email="role@example.com")

        await client.post(
            f"/api/v1/teams/{team['id']}/members",
            json={"user_id": user["id"]},
            headers=admin_headers,
        )

        response = await client.patch(
            f"/api/v1/teams/{team['id']}/members/{user['id']}",
            json={"team_role": TeamRole.SUPERVISOR.value},
            headers=admin_headers,
        )

        assert response.status_code == 200
        assert response.json()["team_role"] == TeamRole.SUPERVISOR.value

    async def test_should_remove_member(self, client, admin_headers):
        team = await _create_team(client, admin_headers)
        user = await _create_user(client, admin_headers, email="remove@example.com")

        await client.post(
            f"/api/v1/teams/{team['id']}/members",
            json={"user_id": user["id"]},
            headers=admin_headers,
        )

        remove_response = await client.delete(
            f"/api/v1/teams/{team['id']}/members/{user['id']}",
            headers=admin_headers,
        )
        assert remove_response.status_code == 204

        list_response = await client.get(
            f"/api/v1/teams/{team['id']}/members",
            headers=admin_headers,
        )
        assert list_response.status_code == 200
        assert list_response.json() == []

    async def test_should_list_members(self, client, admin_headers):
        team = await _create_team(client, admin_headers)
        user1 = await _create_user(
            client, admin_headers, email="m1@example.com", name="Ana"
        )
        user2 = await _create_user(
            client, admin_headers, email="m2@example.com", name="Carlos"
        )

        for user in (user1, user2):
            await client.post(
                f"/api/v1/teams/{team['id']}/members",
                json={"user_id": user["id"]},
                headers=admin_headers,
            )

        response = await client.get(
            f"/api/v1/teams/{team['id']}/members",
            headers=admin_headers,
        )

        assert response.status_code == 200
        names = {m["name"] for m in response.json()}
        assert names == {"Ana", "Carlos"}

    async def test_member_count_reflects_members(self, client, admin_headers):
        team = await _create_team(client, admin_headers)
        user = await _create_user(client, admin_headers, email="count@example.com")

        await client.post(
            f"/api/v1/teams/{team['id']}/members",
            json={"user_id": user["id"]},
            headers=admin_headers,
        )

        response = await client.get(
            f"/api/v1/teams/{team['id']}",
            headers=admin_headers,
        )

        assert response.status_code == 200
        assert response.json()["member_count"] == 1
