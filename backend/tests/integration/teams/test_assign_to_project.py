from sqlalchemy import select

from app.modules.project.infrastructure.models import ProjectMember
from app.modules.teams.infrastructure.enums import TeamRole


async def _create_user(client, *, email: str, name: str = "Ana"):
    response = await client.post(
        "/api/v1/identity/",
        json={
            "email": email,
            "password": "password123",
            "name": name,
            "last_name": "Test",
            "role": "user",
            "position": "desarrollador",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


async def _create_team_with_members(client, admin_headers, users):
    team_response = await client.post(
        "/api/v1/teams/",
        json={"name": "Equipo de Desarrollo"},
        headers=admin_headers,
    )
    assert team_response.status_code == 201, team_response.text
    team = team_response.json()

    for user, role in users:
        member_response = await client.post(
            f"/api/v1/teams/{team['id']}/members",
            json={"user_id": user["id"], "team_role": role.value},
            headers=admin_headers,
        )
        assert member_response.status_code == 201, member_response.text

    return team


class TestAssignTeamToProject:
    async def test_should_copy_team_members_into_project(
        self, client, admin_headers, valid_project_payload, db_session
    ):
        project_response = await client.post(
            "/api/v1/projects/",
            json=valid_project_payload,
            headers=admin_headers,
        )
        assert project_response.status_code == 201
        project = project_response.json()

        lider = await _create_user(client, email="lider@example.com", name="Luis")
        integrante = await _create_user(client, email="int@example.com", name="Ana")
        team = await _create_team_with_members(
            client,
            admin_headers,
            [(lider, TeamRole.LIDER), (integrante, TeamRole.INTEGRANTE)],
        )

        assign_response = await client.post(
            f"/api/v1/projects/{project['id']}/teams/{team['id']}",
            headers=admin_headers,
        )

        assert assign_response.status_code == 201, assign_response.text
        body = assign_response.json()
        assert body["assigned"] == 2
        assert body["skipped"] == 0

        members_response = await client.get(
            f"/api/v1/projects/{project['id']}/members",
            headers=admin_headers,
        )
        assert members_response.status_code == 200
        members = members_response.json()
        assert len(members) == 2
        # Opción A: todos entran como integrante del proyecto, sin importar su rol
        # dentro del equipo. El admin puede reajustar después.
        assert all(m["project_role"] == "integrante" for m in members)

        # El snapshot deja rastro del equipo de origen (source_team_id).
        rows = await db_session.execute(
            select(ProjectMember).where(ProjectMember.project_id == project["id"])
        )
        project_members = rows.scalars().all()
        assert len(project_members) == 2
        assert all(str(pm.source_team_id) == team["id"] for pm in project_members)

    async def test_should_skip_existing_members(
        self, client, admin_headers, valid_project_payload
    ):
        project_response = await client.post(
            "/api/v1/projects/",
            json=valid_project_payload,
            headers=admin_headers,
        )
        project = project_response.json()

        existing = await _create_user(client, email="existing@example.com")
        new_member = await _create_user(client, email="new@example.com", name="Carlos")

        # El usuario ya es miembro del proyecto antes de asignar el equipo.
        await client.post(
            "/api/v1/projects/members/",
            json={
                "user_id": existing["id"],
                "project_id": project["id"],
                "project_role": "coordinador",
            },
            headers=admin_headers,
        )

        team = await _create_team_with_members(
            client,
            admin_headers,
            [(existing, TeamRole.INTEGRANTE), (new_member, TeamRole.INTEGRANTE)],
        )

        assign_response = await client.post(
            f"/api/v1/projects/{project['id']}/teams/{team['id']}",
            headers=admin_headers,
        )

        assert assign_response.status_code == 201
        body = assign_response.json()
        assert body["assigned"] == 1
        assert body["skipped"] == 1

        members_response = await client.get(
            f"/api/v1/projects/{project['id']}/members",
            headers=admin_headers,
        )
        members = members_response.json()
        # No se duplica: sigue habiendo un único registro por usuario y el rol
        # original del miembro existente (coordinador) se conserva.
        assert len(members) == 2
        roles_by_user = {m["user_id"]: m["project_role"] for m in members}
        assert roles_by_user[existing["id"]] == "coordinador"
        assert roles_by_user[new_member["id"]] == "integrante"

    async def test_should_404_when_team_missing(
        self, client, admin_headers, valid_project_payload
    ):
        project_response = await client.post(
            "/api/v1/projects/",
            json=valid_project_payload,
            headers=admin_headers,
        )
        project = project_response.json()

        response = await client.post(
            f"/api/v1/projects/{project['id']}/teams/"
            "00000000-0000-0000-0000-000000000000",
            headers=admin_headers,
        )

        assert response.status_code == 404

    async def test_should_404_when_project_missing(self, client, admin_headers):
        integrante = await _create_user(client, email="solo@example.com")
        team = await _create_team_with_members(
            client, admin_headers, [(integrante, TeamRole.INTEGRANTE)]
        )

        response = await client.post(
            "/api/v1/projects/00000000-0000-0000-0000-000000000000/"
            f"teams/{team['id']}",
            headers=admin_headers,
        )

        assert response.status_code == 404
