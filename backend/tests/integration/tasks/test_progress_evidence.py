"""El responsable edita el avance de su tarea; cada edición exige evidencia.

Reglas: solo el responsable; la tarea debe estar en curso y sin subtareas; el
100 % no se declara; y el archivo queda vinculado a la tarea (trazabilidad).
"""

from datetime import date, timedelta
from uuid import uuid4

from app.core.security import create_access_token, hash_password
from app.modules.identity.infrastructure.enums import SystemRole, UserPosition
from app.modules.identity.infrastructure.models import User
from app.modules.project.infrastructure.models import Project, ProjectMember
from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.tasks.infrastructure.models import Task


async def _user(db, name="Ana") -> User:
    u = User(
        email=f"u-{uuid4()}@test.com",
        password=hash_password("Secret123*"),
        name=name,
        last_name="Ape",
        role=SystemRole.USER,
        position=UserPosition.DESARROLLADOR,
        is_active=True,
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


def _h(user) -> dict:
    return {
        "Authorization": f"Bearer {create_access_token(user_id=user.id, role=user.role.value)}"
    }


async def _task(db, owner, status=TaskStatus.EN_PROGRESO, parent_id=None, project=None):
    if project is None:
        project = Project(
            name=f"P {uuid4()}",
            description="avance",
            client_name="T",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=60),
        )
        db.add(project)
        await db.flush()
        db.add(ProjectMember(project_id=project.id, user_id=owner.id))
    task = Task(
        title="Guion",
        project_id=project.id,
        assignee_id=owner.id,
        status=status,
        parent_task_id=parent_id,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    await db.refresh(project)
    return project, task


def _evidence(name="avance.pdf"):
    return {"file": (name, b"contenido", "application/pdf")}


URL = "/api/v1/tasks/{}/progress"


class TestRegisterProgress:
    async def test_owner_updates_progress_with_a_file_and_it_is_traceable(
        self, client, db_session
    ):
        owner = await _user(db_session)
        project, task = await _task(db_session, owner)

        r = await client.post(
            URL.format(task.id),
            data={"progress_pct": "60", "note": "Va el guion"},
            files=_evidence(),
            headers=_h(owner),
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["progress_pct"] == 60
        assert body["manual_progress_pct"] == 60
        update = body["updates"][0]
        assert (update["previous_pct"], update["new_pct"]) == (35, 60)
        assert update["evidence"]["kind"] == "file"
        assert update["evidence"]["label"] == "avance.pdf"

        # El avance se ve en el listado de la tarea y el archivo cuelga de ella.
        tasks = await client.get(
            f"/api/v1/projects/{project.id}/tasks", headers=_h(owner)
        )
        listed = {t["id"]: t for t in tasks.json()}
        assert listed[str(task.id)]["progress_pct"] == 60
        assert [o["label"] for o in body["evidence_options"]] == ["avance.pdf"]

        # En el archivador, el archivo dice de qué tarea es.
        tree = await client.get(
            f"/api/v1/projects/{project.id}/files", headers=_h(owner)
        )
        folder = tree.json()["root"]["children"][0]
        assert [(f["task_id"], f["task_title"]) for f in folder["files"]] == [
            (str(task.id), "Guion")
        ]

    async def test_an_existing_linked_file_can_back_a_second_edit(
        self, client, db_session
    ):
        owner = await _user(db_session)
        _, task = await _task(db_session, owner)
        h = _h(owner)
        first = await client.post(
            URL.format(task.id),
            data={"progress_pct": "40"},
            files=_evidence(),
            headers=h,
        )
        file_id = first.json()["updates"][0]["evidence"]["file_id"]

        second = await client.post(
            URL.format(task.id),
            data={"progress_pct": "70", "file_id": file_id},
            headers=h,
        )
        assert second.status_code == 200, second.text
        assert second.json()["progress_pct"] == 70
        assert len(second.json()["updates"]) == 2

    async def test_evidence_is_mandatory(self, client, db_session):
        owner = await _user(db_session)
        _, task = await _task(db_session, owner)
        r = await client.post(
            URL.format(task.id), data={"progress_pct": "50"}, headers=_h(owner)
        )
        assert r.status_code == 422, r.text

    async def test_only_the_owner_can_edit(self, client, db_session):
        owner = await _user(db_session)
        other = await _user(db_session, name="Otro")
        _, task = await _task(db_session, owner)
        r = await client.post(
            URL.format(task.id),
            data={"progress_pct": "50"},
            files=_evidence(),
            headers=_h(other),
        )
        assert r.status_code == 403, r.text

    async def test_hundred_percent_is_not_declarable(self, client, db_session):
        owner = await _user(db_session)
        _, task = await _task(db_session, owner)
        r = await client.post(
            URL.format(task.id),
            data={"progress_pct": "100"},
            files=_evidence(),
            headers=_h(owner),
        )
        assert r.status_code == 422, r.text

    async def test_a_task_not_started_cannot_report_progress(self, client, db_session):
        owner = await _user(db_session)
        _, task = await _task(
            db_session, owner, status=TaskStatus.PENDIENTE_POR_INICIAR
        )
        r = await client.post(
            URL.format(task.id),
            data={"progress_pct": "20"},
            files=_evidence(),
            headers=_h(owner),
        )
        assert r.status_code == 422, r.text

    async def test_a_parent_task_derives_progress_from_its_subtasks(
        self, client, db_session
    ):
        owner = await _user(db_session)
        project, parent = await _task(db_session, owner)
        await _task(db_session, owner, parent_id=parent.id, project=project)
        r = await client.post(
            URL.format(parent.id),
            data={"progress_pct": "20"},
            files=_evidence(),
            headers=_h(owner),
        )
        assert r.status_code == 422, r.text

        state = await client.get(URL.format(parent.id), headers=_h(owner))
        assert state.json()["can_edit"] is False
        assert state.json()["locked_reason"]

    async def test_state_tells_the_owner_it_can_edit(self, client, db_session):
        owner = await _user(db_session)
        other = await _user(db_session, name="Otro")
        _, task = await _task(db_session, owner)
        mine = await client.get(URL.format(task.id), headers=_h(owner))
        theirs = await client.get(URL.format(task.id), headers=_h(other))
        assert mine.json()["can_edit"] is True
        assert theirs.json()["can_edit"] is False
