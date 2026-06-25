from uuid import uuid4

import pytest_asyncio

from app.core.security import create_access_token, hash_password
from app.modules.identity.infrastructure.enums import SystemRole, UserPosition
from app.modules.identity.infrastructure.models import User
from app.modules.teams.infrastructure.enums import TeamRole
from app.modules.teams.infrastructure.models import Team, TeamMember

BASE = "/api/v1/teams"


async def _make_user(db, role=SystemRole.USER):
    user = User(
        email=f"u-{uuid4()}@test.com",
        password=hash_password("Secret123*"),
        name="Nombre",
        last_name="Apellido",
        role=role,
        position=UserPosition.DESARROLLADOR,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


def _headers(user):
    token = create_access_token(user_id=user.id, role=user.role.value)
    return {"Authorization": f"Bearer {token}"}


class _Scenario:
    """Equipo con un integrante y un líder, más un admin y un externo."""

    def __init__(self, team, integrante, lider, admin, outsider):
        self.team = team
        self.integrante = integrante
        self.lider = lider
        self.admin = admin
        self.outsider = outsider


@pytest_asyncio.fixture
async def scenario(db_session) -> _Scenario:
    integrante = await _make_user(db_session)
    lider = await _make_user(db_session)
    admin = await _make_user(db_session, role=SystemRole.ADMIN)
    outsider = await _make_user(db_session)

    team = Team(name=f"Equipo {uuid4()}")
    db_session.add(team)
    await db_session.flush()
    db_session.add_all(
        [
            TeamMember(
                team_id=team.id, user_id=integrante.id, team_role=TeamRole.INTEGRANTE
            ),
            TeamMember(team_id=team.id, user_id=lider.id, team_role=TeamRole.LIDER),
        ]
    )
    await db_session.commit()
    return _Scenario(team, integrante, lider, admin, outsider)


async def _create_deliverable(client, team_id, headers, assignee_id):
    res = await client.post(
        f"{BASE}/{team_id}/deliverables",
        json={"task_title": "Prototipo Módulo 1", "assignee_id": str(assignee_id)},
        headers=headers,
    )
    return res


class TestWorkspaceAccess:
    async def test_access_flags_for_integrante_and_lider(self, client, scenario):
        s = scenario
        ri = await client.get(
            f"{BASE}/{s.team.id}/workspace/access", headers=_headers(s.integrante)
        )
        assert ri.json() == {
            "team_role": "integrante",
            "can_view": True,
            "can_deliver": True,
            "can_review": False,
        }
        rl = await client.get(
            f"{BASE}/{s.team.id}/workspace/access", headers=_headers(s.lider)
        )
        assert rl.json()["can_review"] is True

    async def test_mine_lists_only_my_teams(self, client, scenario):
        s = scenario
        r = await client.get(f"{BASE}/mine", headers=_headers(s.integrante))
        assert r.status_code == 200
        ids = [t["id"] for t in r.json()]
        assert str(s.team.id) in ids
        # El externo no pertenece a ningún equipo del escenario.
        r2 = await client.get(f"{BASE}/mine", headers=_headers(s.outsider))
        assert str(s.team.id) not in [t["id"] for t in r2.json()]

    async def test_admin_can_view_but_not_deliver(self, client, scenario):
        s = scenario
        r = await client.get(
            f"{BASE}/{s.team.id}/workspace/access", headers=_headers(s.admin)
        )
        body = r.json()
        assert body["can_view"] is True  # el admin observa
        assert body["can_deliver"] is False  # pero no entrega
        assert body["team_role"] is None


class TestWorkspacePrivacy:
    async def test_outsider_cannot_view(self, client, scenario):
        s = scenario
        r = await client.get(
            f"{BASE}/{s.team.id}/deliverables", headers=_headers(s.outsider)
        )
        assert r.status_code == 403

    async def test_admin_can_list(self, client, scenario):
        s = scenario
        await _create_deliverable(
            client, s.team.id, _headers(s.integrante), s.integrante.id
        )
        r = await client.get(
            f"{BASE}/{s.team.id}/deliverables", headers=_headers(s.admin)
        )
        assert r.status_code == 200
        assert len(r.json()) == 1

    async def test_data_stays_within_the_team(self, client, scenario, db_session):
        """Un entregable del equipo A no es visible bajo el path del equipo B."""
        s = scenario
        created = await _create_deliverable(
            client, s.team.id, _headers(s.integrante), s.integrante.id
        )
        deliverable_id = created.json()["id"]

        other_team = Team(name=f"Otro {uuid4()}")
        db_session.add(other_team)
        await db_session.flush()
        db_session.add(
            TeamMember(
                team_id=other_team.id,
                user_id=s.integrante.id,
                team_role=TeamRole.INTEGRANTE,
            )
        )
        await db_session.commit()

        r = await client.get(
            f"{BASE}/{other_team.id}/deliverables/{deliverable_id}",
            headers=_headers(s.integrante),
        )
        assert r.status_code == 404


class TestWorkspaceRolePermissions:
    async def test_integrante_delivers_and_comments_but_cannot_review(
        self, client, scenario
    ):
        s = scenario
        created = await _create_deliverable(
            client, s.team.id, _headers(s.integrante), s.integrante.id
        )
        assert created.status_code == 201
        del_id = created.json()["id"]

        # Entrega (versión) -> pasa a en_revision.
        v = await client.post(
            f"{BASE}/{s.team.id}/deliverables/{del_id}/versions",
            json={"type": "repositorio", "url": "https://github.com/org/repo/pull/1"},
            headers=_headers(s.integrante),
        )
        assert v.status_code == 201
        assert v.json()["status"] == "en_revision"
        assert v.json()["versions"][0]["type"] == "repositorio"

        # Comentario normal: permitido.
        c = await client.post(
            f"{BASE}/{s.team.id}/deliverables/{del_id}/comments",
            json={"content": "Listo para revisión"},
            headers=_headers(s.integrante),
        )
        assert c.status_code == 201

        # Aprobar / solicitar cambios: PROHIBIDO para integrante.
        for ctype in ("aprobacion", "solicitud_cambio"):
            r = await client.post(
                f"{BASE}/{s.team.id}/deliverables/{del_id}/comments",
                json={"content": "x", "type": ctype},
                headers=_headers(s.integrante),
            )
            assert r.status_code == 403

    async def test_lider_can_approve(self, client, scenario):
        s = scenario
        created = await _create_deliverable(
            client, s.team.id, _headers(s.integrante), s.integrante.id
        )
        del_id = created.json()["id"]
        r = await client.post(
            f"{BASE}/{s.team.id}/deliverables/{del_id}/comments",
            json={"content": "Aprobado, buen trabajo", "type": "aprobacion"},
            headers=_headers(s.lider),
        )
        assert r.status_code == 201
        assert r.json()["status"] == "aprobado"

    async def test_outsider_cannot_create(self, client, scenario):
        s = scenario
        r = await _create_deliverable(
            client, s.team.id, _headers(s.outsider), s.outsider.id
        )
        assert r.status_code == 403
