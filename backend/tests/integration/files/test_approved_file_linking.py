"""El archivo final de un entregable aprobado queda enlazado en la carpeta de su
elemento de la estructura.

Mientras se trabaja, los archivos viven en la carpeta de la persona o del
equipo; al aprobarse, el último queda además en la carpeta compartida que la
estructura le reservó (sin duplicar bytes).
"""

from datetime import date, timedelta
from uuid import uuid4

from app.core.security import create_access_token, hash_password
from app.modules.identity.infrastructure.enums import SystemRole, UserPosition
from app.modules.identity.infrastructure.models import User
from app.modules.project.infrastructure.models import Project, ProjectMember
from app.modules.project.structure.infrastructure.models import TipoNodo, WorkItem
from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.tasks.infrastructure.models import Task

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


async def _setup(db, owner, *, requires_approval=False):
    """Un proyecto con un elemento «Módulo» y una tarea de `owner` colgada de él."""
    project = Project(
        name=f"P {uuid4()}",
        description="enlace al aprobar",
        client_name="T",
        start_date=date.today(),
        end_date=date.today() + timedelta(days=90),
    )
    db.add(project)
    await db.flush()
    db.add(ProjectMember(project_id=project.id, user_id=owner.id))
    tipo = TipoNodo(id=uuid4(), proyecto_id=project.id, nombre="Elemento")
    db.add(tipo)
    await db.flush()
    item = WorkItem(
        id=uuid4(),
        proyecto_id=project.id,
        tipo_id=tipo.id,
        nombre="Módulo 1",
        orden=0,
    )
    db.add(item)
    await db.flush()
    task = Task(
        title="Guion",
        project_id=project.id,
        work_item_id=item.id,
        assignee_id=owner.id,
        status=TaskStatus.PENDIENTE_POR_INICIAR,
        requires_approval=requires_approval,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return project, task


async def _deliver_file(client, owner, task, filename="guion.pdf"):
    h = _headers(owner)
    created = await client.post(
        "/api/v1/me/deliverables",
        json={"task_title": task.title, "task_id": str(task.id)},
        headers=h,
    )
    assert created.status_code == 201, created.text
    r = await client.post(
        f"/api/v1/me/deliverables/{created.json()['id']}/versions/upload",
        files={"file": (filename, b"contenido", "application/pdf")},
        headers=h,
    )
    assert r.status_code == 201, r.text


def _folder(tree, name):
    stack = [tree["root"]]
    while stack:
        folder = stack.pop()
        if folder["name"] == name:
            return folder
        stack.extend(folder["children"])
    return None


async def test_an_approved_delivery_is_linked_in_the_element_folder(client, db_session):
    owner = await _user(db_session, name="Ana")
    admin = await _user(db_session, SystemRole.ADMIN)
    project, task = await _setup(db_session, owner)
    await client.post(
        f"{BASE}/{project.id}/files/structure-folders", json={}, headers=_headers(admin)
    )

    await _deliver_file(client, owner, task)

    tree = (
        await client.get(f"{BASE}/{project.id}/files", headers=_headers(admin))
    ).json()
    files = _folder(tree, "Módulo 1")["files"]
    assert [f["name"] for f in files] == ["guion.pdf"]
    assert files[0]["task_id"] == str(task.id)
    # El original sigue en la carpeta de la persona: es copia por enlace.
    assert _folder(tree, "Ana Ape")["files"][0]["name"] == "guion.pdf"


async def test_a_delivery_awaiting_review_is_not_linked_yet(client, db_session):
    owner = await _user(db_session)
    admin = await _user(db_session, SystemRole.ADMIN)
    project, task = await _setup(db_session, owner, requires_approval=True)
    await client.post(
        f"{BASE}/{project.id}/files/structure-folders", json={}, headers=_headers(admin)
    )

    await _deliver_file(client, owner, task)

    tree = (
        await client.get(f"{BASE}/{project.id}/files", headers=_headers(admin))
    ).json()
    assert _folder(tree, "Módulo 1")["files"] == []


async def test_without_generated_folders_the_delivery_just_stays_put(
    client, db_session
):
    owner = await _user(db_session)
    project, task = await _setup(db_session, owner)

    await _deliver_file(client, owner, task)

    tree = (
        await client.get(f"{BASE}/{project.id}/files", headers=_headers(owner))
    ).json()
    assert [f["name"] for f in tree["root"]["children"][0]["files"]] == ["guion.pdf"]
