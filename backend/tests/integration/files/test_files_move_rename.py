"""Renombrar y mover carpetas/archivos del archivador (drag and drop en la UI).

No hay migración detrás de estos endpoints: solo tocan `name`/`parent_id` (o
`folder_id`) de filas que ya existían. Lo que sí hay que proteger a mano es que
nadie arrastre contenido FUERA de su propio equipo, o una carpeta DENTRO de su
propio subárbol.
"""

from datetime import date, timedelta
from uuid import uuid4

from app.core.security import create_access_token, hash_password
from app.modules.identity.infrastructure.enums import SystemRole, UserPosition
from app.modules.identity.infrastructure.models import User
from app.modules.project.infrastructure.models import Project, ProjectMember
from app.modules.teams.infrastructure.enums import TeamRole
from app.modules.teams.infrastructure.models import Team, TeamMember

BASE = "/api/v1/projects"


async def _user(db, role=SystemRole.USER, name="Nom") -> User:
    u = User(
        email=f"u-{uuid4()}@test.com",
        password=hash_password("Secret123*"),
        name=name,
        last_name="Ape",
        role=role,
        position=UserPosition.DESARROLLADOR,
        is_active=True,
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


def _headers(user) -> dict:
    return {
        "Authorization": f"Bearer {create_access_token(user_id=user.id, role=user.role.value)}"
    }


async def _project(db) -> Project:
    project = Project(
        name=f"P {uuid4()}",
        description="mover y renombrar",
        client_name="T",
        start_date=date.today(),
        end_date=date.today() + timedelta(days=90),
    )
    db.add(project)
    await db.flush()
    return project


async def _team_with_lider(db, project_id, lider):
    team = Team(project_id=project_id, name=f"Equipo {uuid4()}")
    db.add(team)
    await db.flush()
    db.add(TeamMember(team_id=team.id, user_id=lider.id, team_role=TeamRole.LIDER))
    db.add(ProjectMember(project_id=project_id, user_id=lider.id))
    await db.commit()
    await db.refresh(team)
    return team


async def _team_folder(client, headers, project_id, team_id, name="Equipo") -> str:
    r = await client.post(
        f"{BASE}/{project_id}/files/folders",
        json={"name": name, "team_id": str(team_id)},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def _subfolder(client, headers, project_id, parent_id, name="Sub") -> str:
    r = await client.post(
        f"{BASE}/{project_id}/files/folders",
        json={"name": name, "parent_id": parent_id},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


class TestRenameFolder:
    async def test_lider_renames_a_subfolder(self, client, db_session):
        lider = await _user(db_session, name="Lia")
        project = await _project(db_session)
        team = await _team_with_lider(db_session, project.id, lider)
        h = _headers(lider)
        team_folder = await _team_folder(client, h, project.id, team.id)
        sub = await _subfolder(client, h, project.id, team_folder, "Borradores")

        r = await client.patch(
            f"{BASE}/{project.id}/files/folders/{sub}",
            json={"name": "Finales"},
            headers=h,
        )
        assert r.status_code == 200, r.text
        assert r.json()["name"] == "Finales"

    async def test_cannot_rename_the_project_root(self, client, db_session):
        lider = await _user(db_session)
        project = await _project(db_session)
        await _team_with_lider(db_session, project.id, lider)
        h = _headers(lider)
        tree = await client.get(f"{BASE}/{project.id}/files", headers=h)
        root_id = tree.json()["root"]["id"]

        r = await client.patch(
            f"{BASE}/{project.id}/files/folders/{root_id}",
            json={"name": "Otra cosa"},
            headers=h,
        )
        assert r.status_code == 403, r.text

    async def test_outsider_cannot_rename(self, client, db_session):
        lider = await _user(db_session)
        outsider = await _user(db_session)
        project = await _project(db_session)
        team = await _team_with_lider(db_session, project.id, lider)
        h = _headers(lider)
        team_folder = await _team_folder(client, h, project.id, team.id)
        sub = await _subfolder(client, h, project.id, team_folder)

        r = await client.patch(
            f"{BASE}/{project.id}/files/folders/{sub}",
            json={"name": "Robado"},
            headers=_headers(outsider),
        )
        assert r.status_code in (403, 404)


class TestMoveFolder:
    async def test_moves_a_subfolder_into_a_sibling(self, client, db_session):
        lider = await _user(db_session)
        project = await _project(db_session)
        team = await _team_with_lider(db_session, project.id, lider)
        h = _headers(lider)
        team_folder = await _team_folder(client, h, project.id, team.id)
        a = await _subfolder(client, h, project.id, team_folder, "A")
        b = await _subfolder(client, h, project.id, team_folder, "B")

        r = await client.patch(
            f"{BASE}/{project.id}/files/folders/{a}/move",
            json={"parent_id": b},
            headers=h,
        )
        assert r.status_code == 200, r.text
        assert r.json()["parent_id"] == b

    async def test_cannot_move_a_folder_into_its_own_descendant(
        self, client, db_session
    ):
        lider = await _user(db_session)
        project = await _project(db_session)
        team = await _team_with_lider(db_session, project.id, lider)
        h = _headers(lider)
        team_folder = await _team_folder(client, h, project.id, team.id)
        parent = await _subfolder(client, h, project.id, team_folder, "Padre")
        child = await _subfolder(client, h, project.id, parent, "Hijo")

        r = await client.patch(
            f"{BASE}/{project.id}/files/folders/{parent}/move",
            json={"parent_id": child},
            headers=h,
        )
        assert r.status_code == 403, r.text

    async def test_cannot_move_a_folder_into_the_root(self, client, db_session):
        lider = await _user(db_session)
        project = await _project(db_session)
        team = await _team_with_lider(db_session, project.id, lider)
        h = _headers(lider)
        team_folder = await _team_folder(client, h, project.id, team.id)
        sub = await _subfolder(client, h, project.id, team_folder)

        tree = await client.get(f"{BASE}/{project.id}/files", headers=h)
        root_id = tree.json()["root"]["id"]

        r = await client.patch(
            f"{BASE}/{project.id}/files/folders/{sub}/move",
            json={"parent_id": root_id},
            headers=h,
        )
        assert r.status_code == 403, r.text

    async def test_cannot_move_content_into_another_teams_folder(
        self, client, db_session
    ):
        lider_a = await _user(db_session, name="LiderA")
        lider_b = await _user(db_session, name="LiderB")
        project = await _project(db_session)
        team_a = await _team_with_lider(db_session, project.id, lider_a)
        team_b = await _team_with_lider(db_session, project.id, lider_b)
        h_a = _headers(lider_a)

        folder_a = await _team_folder(client, h_a, project.id, team_a.id, "Equipo A")
        sub_a = await _subfolder(client, h_a, project.id, folder_a, "Mio")
        folder_b = await _team_folder(
            client, _headers(lider_b), project.id, team_b.id, "Equipo B"
        )

        r = await client.patch(
            f"{BASE}/{project.id}/files/folders/{sub_a}/move",
            json={"parent_id": folder_b},
            headers=h_a,
        )
        assert r.status_code == 403, r.text


class TestRenameAndMoveFile:
    async def test_renames_a_file(self, client, db_session):
        lider = await _user(db_session)
        project = await _project(db_session)
        team = await _team_with_lider(db_session, project.id, lider)
        h = _headers(lider)
        team_folder = await _team_folder(client, h, project.id, team.id)
        up = await client.post(
            f"{BASE}/{project.id}/files/folders/{team_folder}/upload",
            files={"file": ("a.txt", b"hola", "text/plain")},
            headers=h,
        )
        file_id = up.json()["id"]

        r = await client.patch(
            f"{BASE}/{project.id}/files/{file_id}",
            json={"name": "b.txt"},
            headers=h,
        )
        assert r.status_code == 200, r.text
        assert r.json()["name"] == "b.txt"

    async def test_moves_a_file_into_a_subfolder(self, client, db_session):
        lider = await _user(db_session)
        project = await _project(db_session)
        team = await _team_with_lider(db_session, project.id, lider)
        h = _headers(lider)
        team_folder = await _team_folder(client, h, project.id, team.id)
        sub = await _subfolder(client, h, project.id, team_folder)
        up = await client.post(
            f"{BASE}/{project.id}/files/folders/{team_folder}/upload",
            files={"file": ("a.txt", b"hola", "text/plain")},
            headers=h,
        )
        file_id = up.json()["id"]

        r = await client.patch(
            f"{BASE}/{project.id}/files/{file_id}/move",
            json={"folder_id": sub},
            headers=h,
        )
        assert r.status_code == 200, r.text
        assert r.json()["folder_id"] == sub

    async def test_cannot_move_a_file_into_another_teams_folder(
        self, client, db_session
    ):
        lider_a = await _user(db_session, name="LiderA")
        lider_b = await _user(db_session, name="LiderB")
        project = await _project(db_session)
        team_a = await _team_with_lider(db_session, project.id, lider_a)
        team_b = await _team_with_lider(db_session, project.id, lider_b)
        h_a = _headers(lider_a)

        folder_a = await _team_folder(client, h_a, project.id, team_a.id, "Equipo A")
        up = await client.post(
            f"{BASE}/{project.id}/files/folders/{folder_a}/upload",
            files={"file": ("a.txt", b"hola", "text/plain")},
            headers=h_a,
        )
        file_id = up.json()["id"]
        folder_b = await _team_folder(
            client, _headers(lider_b), project.id, team_b.id, "Equipo B"
        )

        r = await client.patch(
            f"{BASE}/{project.id}/files/{file_id}/move",
            json={"folder_id": folder_b},
            headers=h_a,
        )
        assert r.status_code == 403, r.text
