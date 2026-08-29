"""Invitaciones a equipos (fase 5).

Un líder invita a un integrante del proyecto; la persona entra al equipo solo
tras aceptar.
"""

from datetime import date, timedelta
from uuid import uuid4

import pytest_asyncio

from app.core.security import create_access_token, hash_password
from app.modules.identity.infrastructure.enums import SystemRole, UserPosition
from app.modules.identity.infrastructure.models import User
from app.modules.project.infrastructure.enums import ProjectRole
from app.modules.project.infrastructure.models import Project, ProjectMember
from app.modules.teams.infrastructure.enums import TeamRole
from app.modules.teams.infrastructure.models import Team, TeamMember

API = "/api/v1"


def _headers(user):
    return {
        "Authorization": f"Bearer {create_access_token(user_id=user.id, role=user.role.value)}"
    }


async def _user(db, role=SystemRole.USER):
    u = User(
        email=f"u-{uuid4()}@test.com",
        password=hash_password("Secret123*"),
        name="Nom",
        last_name="Ape",
        role=role,
        position=UserPosition.DESARROLLADOR,
        is_active=True,
    )
    db.add(u)
    await db.flush()
    return u


class _Scenario:
    def __init__(self, project, team, lider, member_in_project, admin, outsider):
        self.project = project
        self.team = team
        self.lider = lider
        # Integrante del PROYECTO, aún no del equipo: candidato a invitación.
        self.candidate = member_in_project
        self.admin = admin
        self.outsider = outsider


@pytest_asyncio.fixture
async def scenario(db_session) -> _Scenario:
    lider = await _user(db_session)
    candidate = await _user(db_session)
    admin = await _user(db_session, role=SystemRole.ADMIN)
    outsider = await _user(db_session)

    project = Project(
        name=f"Proj {uuid4()}",
        description="inv",
        start_date=date.today(),
        end_date=date.today() + timedelta(days=60),
    )
    db_session.add(project)
    await db_session.flush()

    team = Team(project_id=project.id, name=f"Equipo {uuid4()}")
    db_session.add(team)
    await db_session.flush()

    db_session.add_all(
        [
            TeamMember(team_id=team.id, user_id=lider.id, team_role=TeamRole.LIDER),
            ProjectMember(
                project_id=project.id,
                user_id=lider.id,
                project_role=ProjectRole.INTEGRANTE,
            ),
            ProjectMember(
                project_id=project.id,
                user_id=candidate.id,
                project_role=ProjectRole.INTEGRANTE,
            ),
        ]
    )
    await db_session.commit()
    return _Scenario(project, team, lider, candidate, admin, outsider)


def _invite_url(s):
    return f"{API}/projects/{s.project.id}/teams/{s.team.id}/invitations"


class TestTeamInvitations:
    async def test_lider_invites_project_member_and_they_accept(self, client, scenario):
        s = scenario
        res = await client.post(
            _invite_url(s),
            json={"user_id": str(s.candidate.id)},
            headers=_headers(s.lider),
        )
        assert res.status_code == 201, res.text
        inv = res.json()
        assert inv["status"] == "pendiente"
        assert inv["user_id"] == str(s.candidate.id)

        # Visibilidad del admin: pendientes del proyecto.
        pend = await client.get(
            f"{API}/projects/{s.project.id}/teams/invitations/pending",
            headers=_headers(s.admin),
        )
        assert [i["id"] for i in pend.json()] == [inv["id"]]

        # El invitado la ve en "mías".
        mine = await client.get(
            f"{API}/teams/invitations/mine", headers=_headers(s.candidate)
        )
        assert [i["id"] for i in mine.json()] == [inv["id"]]

        # Todavía NO es miembro del equipo.
        members = await client.get(
            f"{API}/teams/{s.team.id}/members", headers=_headers(s.lider)
        )
        assert str(s.candidate.id) not in {m["user_id"] for m in members.json()}

        # Acepta -> se convierte en miembro.
        acc = await client.post(
            f"{API}/teams/invitations/{inv['id']}/accept",
            headers=_headers(s.candidate),
        )
        assert acc.status_code == 200, acc.text
        assert acc.json()["status"] == "aceptada"

        members = await client.get(
            f"{API}/teams/{s.team.id}/members", headers=_headers(s.lider)
        )
        assert str(s.candidate.id) in {m["user_id"] for m in members.json()}

    async def test_cannot_invite_non_project_member(self, client, scenario):
        s = scenario
        res = await client.post(
            _invite_url(s),
            json={"user_id": str(s.outsider.id)},
            headers=_headers(s.lider),
        )
        assert res.status_code == 409, res.text

    async def test_only_lider_or_admin_can_invite(self, client, scenario):
        s = scenario
        # `candidate` es integrante del proyecto pero no líder del equipo.
        res = await client.post(
            _invite_url(s),
            json={"user_id": str(s.candidate.id)},
            headers=_headers(s.candidate),
        )
        assert res.status_code == 403, res.text

    async def test_reject_then_reinvite_reuses_row(self, client, scenario):
        s = scenario
        first = await client.post(
            _invite_url(s),
            json={"user_id": str(s.candidate.id)},
            headers=_headers(s.lider),
        )
        inv_id = first.json()["id"]

        rej = await client.post(
            f"{API}/teams/invitations/{inv_id}/reject",
            headers=_headers(s.candidate),
        )
        assert rej.status_code == 200
        assert rej.json()["status"] == "rechazada"

        again = await client.post(
            _invite_url(s),
            json={"user_id": str(s.candidate.id)},
            headers=_headers(s.lider),
        )
        assert again.status_code == 201, again.text
        assert again.json()["id"] == inv_id  # misma fila
        assert again.json()["status"] == "pendiente"

    async def test_cannot_accept_someone_elses_invitation(self, client, scenario):
        s = scenario
        inv = await client.post(
            _invite_url(s),
            json={"user_id": str(s.candidate.id)},
            headers=_headers(s.lider),
        )
        res = await client.post(
            f"{API}/teams/invitations/{inv.json()['id']}/accept",
            headers=_headers(s.outsider),
        )
        assert res.status_code == 403, res.text

    async def test_cannot_respond_twice(self, client, scenario):
        s = scenario
        inv = await client.post(
            _invite_url(s),
            json={"user_id": str(s.candidate.id)},
            headers=_headers(s.lider),
        )
        inv_id = inv.json()["id"]
        assert (
            await client.post(
                f"{API}/teams/invitations/{inv_id}/accept",
                headers=_headers(s.candidate),
            )
        ).status_code == 200
        second = await client.post(
            f"{API}/teams/invitations/{inv_id}/reject",
            headers=_headers(s.candidate),
        )
        assert second.status_code == 409, second.text
