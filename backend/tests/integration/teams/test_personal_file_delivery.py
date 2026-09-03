"""Una tarea INDIVIDUAL también se entrega con un archivo.

La tarea de equipo ya dejaba su archivo en la carpeta del equipo; la individual
no tiene equipo, así que su material se quedaba fuera de la herramienta. Ahora
cae en la carpeta de la persona dentro del archivador del proyecto, y esa
carpeta se comporta como la de un equipo: la ve su dueña y quien mira el
proyecto entero, nadie más.
"""

from datetime import date, timedelta
from uuid import uuid4

from app.core.security import create_access_token, hash_password
from app.modules.identity.infrastructure.enums import SystemRole, UserPosition
from app.modules.identity.infrastructure.models import User
from app.modules.project.infrastructure.enums import ProjectRole
from app.modules.project.infrastructure.models import Project, ProjectMember
from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.tasks.infrastructure.models import Task


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


async def _project_with_task(db, owner_id):
    project = Project(
        name=f"P {uuid4()}",
        description="archivo personal",
        client_name="T",
        start_date=date.today(),
        end_date=date.today() + timedelta(days=90),
    )
    db.add(project)
    await db.flush()
    db.add(ProjectMember(project_id=project.id, user_id=owner_id))
    task = Task(
        title="Informe",
        project_id=project.id,
        assignee_id=owner_id,
        status=TaskStatus.PENDIENTE_POR_INICIAR,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    await db.refresh(project)
    return project, task


async def _deliverable(client, headers, task) -> str:
    r = await client.post(
        "/api/v1/me/deliverables",
        json={"task_title": task.title, "task_id": str(task.id)},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _upload(content=b"contenido", filename="informe.pdf"):
    return {"file": (filename, content, "application/pdf")}


class TestPersonalFileDelivery:
    async def test_delivering_a_file_creates_the_version_and_files_it(
        self, client, db_session
    ):
        owner = await _user(db_session, name="Ana")
        project, task = await _project_with_task(db_session, owner.id)
        h = _headers(owner)
        deliverable_id = await _deliverable(client, h, task)

        r = await client.post(
            f"/api/v1/me/deliverables/{deliverable_id}/versions/upload",
            files=_upload(),
            data={"note": "Primera versión"},
            headers=h,
        )
        assert r.status_code == 201, r.text
        version = r.json()["versions"][-1]
        assert version["type"] == "archivo"
        assert version["file_id"] is not None
        assert version["file_name"] == "informe.pdf"

        # …y el archivo vive en la carpeta de la persona, dentro del proyecto.
        tree = await client.get(f"/api/v1/projects/{project.id}/files", headers=h)
        assert tree.status_code == 200, tree.text
        folders = tree.json()["root"]["children"]
        assert [f["name"] for f in folders] == ["Ana Ape"]
        assert [f["name"] for f in folders[0]["files"]] == ["informe.pdf"]

    async def test_a_second_delivery_does_not_clash_on_the_file_name(
        self, client, db_session
    ):
        owner = await _user(db_session)
        project, task = await _project_with_task(db_session, owner.id)
        h = _headers(owner)
        deliverable_id = await _deliverable(client, h, task)

        for _ in range(2):
            r = await client.post(
                f"/api/v1/me/deliverables/{deliverable_id}/versions/upload",
                files=_upload(),
                headers=h,
            )
            assert r.status_code == 201, r.text

        tree = await client.get(f"/api/v1/projects/{project.id}/files", headers=h)
        names = {f["name"] for f in tree.json()["root"]["children"][0]["files"]}
        assert names == {"informe.pdf", "informe (2).pdf"}

    async def test_an_unlinked_deliverable_cannot_take_files(self, client, db_session):
        # Sin tarea no hay proyecto, y sin proyecto no hay archivador: se dice
        # con un mensaje, no con un 500.
        owner = await _user(db_session)
        h = _headers(owner)
        r = await client.post(
            "/api/v1/me/deliverables", json={"task_title": "Suelta"}, headers=h
        )
        deliverable_id = r.json()["id"]

        r = await client.post(
            f"/api/v1/me/deliverables/{deliverable_id}/versions/upload",
            files=_upload(),
            headers=h,
        )
        assert r.status_code == 422, r.text
        assert "tarea" in r.json()["detail"].lower()


class TestPersonalFolderVisibility:
    async def test_another_member_of_the_project_does_not_see_the_folder(
        self, client, db_session
    ):
        owner = await _user(db_session, name="Ana")
        project, task = await _project_with_task(db_session, owner.id)
        stranger = await _user(db_session, name="Otro")
        db_session.add(ProjectMember(project_id=project.id, user_id=stranger.id))
        await db_session.commit()

        deliverable_id = await _deliverable(client, _headers(owner), task)
        await client.post(
            f"/api/v1/me/deliverables/{deliverable_id}/versions/upload",
            files=_upload(),
            headers=_headers(owner),
        )

        tree = await client.get(
            f"/api/v1/projects/{project.id}/files", headers=_headers(stranger)
        )
        assert tree.status_code == 200, tree.text
        assert tree.json()["root"]["children"] == []

    async def test_the_project_coordinator_no_longer_sees_it(self, client, db_session):
        # El espacio de trabajo es un contexto de equipo: coordinar el proyecto
        # ya no abre el archivador entero. La carpeta individual de otra persona
        # solo la ve esa persona o la administración del sistema.
        owner = await _user(db_session, name="Ana")
        project, task = await _project_with_task(db_session, owner.id)
        coord = await _user(db_session, name="Coord")
        db_session.add(
            ProjectMember(
                project_id=project.id,
                user_id=coord.id,
                project_role=ProjectRole.COORDINADOR,
            )
        )
        await db_session.commit()

        deliverable_id = await _deliverable(client, _headers(owner), task)
        await client.post(
            f"/api/v1/me/deliverables/{deliverable_id}/versions/upload",
            files=_upload(),
            headers=_headers(owner),
        )

        tree = await client.get(
            f"/api/v1/projects/{project.id}/files", headers=_headers(coord)
        )
        assert tree.status_code == 200, tree.text
        assert tree.json()["root"]["children"] == []
