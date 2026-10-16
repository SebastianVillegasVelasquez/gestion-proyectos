"""Carpetas generadas desde la estructura del proyecto.

Padre → hijo → nieto de la estructura se vuelven carpetas anidadas COMPARTIDAS:
las ve todo el proyecto, pero solo las organiza quien administra o coordina.
"""

from datetime import date, timedelta
from uuid import uuid4

from app.core.security import create_access_token, hash_password
from app.modules.identity.infrastructure.enums import SystemRole, UserPosition
from app.modules.identity.infrastructure.models import User
from app.modules.project.infrastructure.enums import ProjectRole
from app.modules.project.infrastructure.models import Project, ProjectMember
from app.modules.project.structure.infrastructure.models import TipoNodo, WorkItem
from app.modules.tasks.infrastructure.models import Task
from app.modules.teams.infrastructure.enums import TeamRole
from app.modules.teams.infrastructure.models import Team, TeamMember

BASE = "/api/v1/projects"


async def _user(db, role=SystemRole.USER) -> User:
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
    await db.commit()
    await db.refresh(u)
    return u


def _headers(user) -> dict:
    return {
        "Authorization": f"Bearer {create_access_token(user_id=user.id, role=user.role.value)}"
    }


async def _project_with_structure(db):
    """Curso → Módulo → Lección (+ una tarea-elemento «Entrega» bajo el módulo)."""
    project = Project(
        name=f"P {uuid4()}",
        description="carpetas de estructura",
        client_name="T",
        start_date=date.today(),
        end_date=date.today() + timedelta(days=90),
    )
    db.add(project)
    await db.flush()
    tipo = TipoNodo(id=uuid4(), proyecto_id=project.id, nombre="Elemento")
    db.add(tipo)
    await db.flush()

    def item(name, parent=None, orden=0):
        return WorkItem(
            id=uuid4(),
            proyecto_id=project.id,
            parent_id=parent.id if parent else None,
            tipo_id=tipo.id,
            nombre=name,
            orden=orden,
        )

    curso = item("Curso")
    modulo = item("Módulo", curso)
    leccion = item("Lección", modulo)
    entrega = item("Entrega", modulo, orden=1)
    db.add_all([curso, modulo, leccion, entrega])
    await db.flush()
    db.add(
        Task(
            id=uuid4(),
            title="Entrega",
            project_id=project.id,
            work_item_id=entrega.id,
            represents_work_item=True,
        )
    )
    await db.commit()
    return project


async def _team_member(db, project_id, team_role=TeamRole.INTEGRANTE):
    user = await _user(db)
    team = Team(project_id=project_id, name=f"Equipo {uuid4()}")
    db.add(team)
    await db.flush()
    db.add(TeamMember(team_id=team.id, user_id=user.id, team_role=team_role))
    db.add(ProjectMember(project_id=project_id, user_id=user.id))
    await db.commit()
    return user, team


def _names(folder) -> list[str]:
    return [folder["name"]] + [n for c in folder["children"] for n in _names(c)]


async def _generate(client, project_id, user, **body):
    return await client.post(
        f"{BASE}/{project_id}/files/structure-folders",
        json=body,
        headers=_headers(user),
    )


class TestGenerate:
    async def test_admin_builds_the_hierarchy_without_task_elements(
        self, client, db_session
    ):
        admin = await _user(db_session, SystemRole.ADMIN)
        project = await _project_with_structure(db_session)

        r = await _generate(client, project.id, admin)

        assert r.status_code == 201, r.text
        assert r.json() == {"created": 3, "existing": 0, "skipped_task_elements": 1}
        tree = await client.get(f"{BASE}/{project.id}/files", headers=_headers(admin))
        root = tree.json()["root"]
        curso = next(c for c in root["children"] if c["name"] == "Curso")
        modulo = curso["children"][0]
        assert modulo["name"] == "Módulo"
        assert [c["name"] for c in modulo["children"]] == ["Lección"]

    async def test_task_elements_can_be_included(self, client, db_session):
        admin = await _user(db_session, SystemRole.ADMIN)
        project = await _project_with_structure(db_session)

        r = await _generate(client, project.id, admin, include_task_elements=True)

        assert r.json() == {"created": 4, "existing": 0, "skipped_task_elements": 0}

    async def test_is_idempotent(self, client, db_session):
        admin = await _user(db_session, SystemRole.ADMIN)
        project = await _project_with_structure(db_session)
        await _generate(client, project.id, admin)

        r = await _generate(client, project.id, admin)

        assert r.json() == {"created": 0, "existing": 3, "skipped_task_elements": 1}

    async def test_a_plain_member_cannot_generate(self, client, db_session):
        project = await _project_with_structure(db_session)
        member, _ = await _team_member(db_session, project.id, TeamRole.LIDER)

        r = await _generate(client, project.id, member)

        assert r.status_code == 403

    async def test_the_project_coordinator_can_generate(self, client, db_session):
        project = await _project_with_structure(db_session)
        coordinator = await _user(db_session)
        db_session.add(
            ProjectMember(
                project_id=project.id,
                user_id=coordinator.id,
                project_role=ProjectRole.COORDINADOR,
            )
        )
        await db_session.commit()

        r = await _generate(client, project.id, coordinator)

        assert r.status_code == 201, r.text


class TestSharedVisibility:
    async def test_every_team_sees_the_hierarchy(self, client, db_session):
        admin = await _user(db_session, SystemRole.ADMIN)
        project = await _project_with_structure(db_session)
        await _generate(client, project.id, admin)
        member, _ = await _team_member(db_session, project.id)

        tree = await client.get(f"{BASE}/{project.id}/files", headers=_headers(member))

        assert "Lección" in _names(tree.json()["root"])

    async def test_members_upload_but_cannot_reorganise(self, client, db_session):
        admin = await _user(db_session, SystemRole.ADMIN)
        project = await _project_with_structure(db_session)
        await _generate(client, project.id, admin)
        member, _ = await _team_member(db_session, project.id)
        tree = await client.get(f"{BASE}/{project.id}/files", headers=_headers(member))
        curso = next(c for c in tree.json()["root"]["children"] if c["name"] == "Curso")
        assert curso["can_write"] is True
        assert curso["can_organize"] is False

        upload = await client.post(
            f"{BASE}/{project.id}/files/folders/{curso['id']}/upload",
            files={"file": ("a.txt", b"hola", "text/plain")},
            headers=_headers(member),
        )
        rename = await client.patch(
            f"{BASE}/{project.id}/files/folders/{curso['id']}",
            json={"name": "Otro"},
            headers=_headers(member),
        )
        delete = await client.delete(
            f"{BASE}/{project.id}/files/folders/{curso['id']}",
            headers=_headers(member),
        )

        assert upload.status_code == 201, upload.text
        assert rename.status_code == 403
        assert delete.status_code == 403
