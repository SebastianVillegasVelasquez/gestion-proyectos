"""Entregar/aprobar un entregable deja la tarea COMPLETADA por una vía que NO
pasa por `ChangeTaskStatusUseCase`. Aun así, la cascada de fechas finish-to-start
debe dispararse: las tareas que dependen de la recién completada arrancan tras
su fin y recalculan el suyo con sus días estimados.

- Tarea SIN revisión: entregar = completar → cascada inmediata.
- Tarea CON revisión: entregar = EN_REVISION (sin cascada); aprobar = completar
  → cascada.
"""

from datetime import date, timedelta
from uuid import uuid4

from app.core.security import create_access_token, hash_password
from app.modules.identity.infrastructure.enums import SystemRole, UserPosition
from app.modules.identity.infrastructure.models import User
from app.modules.project.infrastructure.models import Project
from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.tasks.infrastructure.models import Task, TaskDependency

T1_DUE = date.today() + timedelta(days=20)


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


async def _chain(db, owner_id, *, requires_approval: bool):
    """project + t1 (con fin) ← t2 depende de t1 (con estimado) ← t3 depende de t2."""
    project = Project(
        name=f"P {uuid4()}",
        description="cascade",
        client_name="T",
        start_date=date.today(),
        end_date=date.today() + timedelta(days=90),
    )
    db.add(project)
    await db.flush()

    def _mk(title, **kw):
        return Task(
            title=title,
            project_id=project.id,
            assignee_id=owner_id,
            status=TaskStatus.PENDIENTE_POR_INICIAR,
            **kw,
        )

    t1 = _mk(
        "T1",
        start_date=date.today(),
        due_date=T1_DUE,
        requires_approval=requires_approval,
    )
    t2 = _mk("T2", estimated_days=3)
    t3 = _mk("T3", estimated_days=2)
    db.add_all([t1, t2, t3])
    await db.flush()
    db.add_all(
        [
            TaskDependency(task_id=t2.id, depends_on_id=t1.id),
            TaskDependency(task_id=t3.id, depends_on_id=t2.id),
        ]
    )
    await db.commit()
    for t in (t1, t2, t3):
        await db.refresh(t)
    return project, t1, t2, t3


async def _create_personal_deliverable(client, headers, task) -> str:
    r = await client.post(
        "/api/v1/me/deliverables",
        json={"task_title": task.title, "task_id": str(task.id)},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


class TestPersonalDeliveryCascade:
    async def test_no_approval_delivery_completes_and_cascades_the_chain(
        self, client, db_session
    ):
        owner = await _user(db_session)
        _, t1, t2, t3 = await _chain(db_session, owner.id, requires_approval=False)
        h = _headers(owner)
        dz = await _create_personal_deliverable(client, h, t1)

        r = await client.post(
            f"/api/v1/me/deliverables/{dz}/versions",
            json={"type": "enlace", "url": "https://ej.com/x"},
            headers=h,
        )
        assert r.status_code == 201, r.text

        await db_session.refresh(t1)
        await db_session.refresh(t2)
        await db_session.refresh(t3)
        assert t1.status == TaskStatus.COMPLETADA
        # t2 arranca en el fin de t1 y dura sus 3 días estimados.
        assert t2.start_date == T1_DUE
        assert t2.due_date == T1_DUE + timedelta(days=3)
        # …y la cadena sigue: t3 tras el fin de t2, + 2 días.
        assert t3.start_date == T1_DUE + timedelta(days=3)
        assert t3.due_date == T1_DUE + timedelta(days=5)

    async def test_delivery_with_approval_waits_for_approval_to_cascade(
        self, client, db_session
    ):
        owner = await _user(db_session)
        reviewer = await _user(db_session, role=SystemRole.ADMIN)
        _, t1, t2, _ = await _chain(db_session, owner.id, requires_approval=True)
        oh, rh = _headers(owner), _headers(reviewer)
        dz = await _create_personal_deliverable(client, oh, t1)

        # Entrega → EN_REVISION, la dependiente NO se mueve todavía.
        r = await client.post(
            f"/api/v1/me/deliverables/{dz}/versions",
            json={"type": "enlace", "url": "https://ej.com/x"},
            headers=oh,
        )
        assert r.status_code == 201, r.text
        await db_session.refresh(t1)
        await db_session.refresh(t2)
        assert t1.status == TaskStatus.EN_REVISION
        assert t2.start_date is None

        # Aprobación de un revisor → COMPLETADA y ahora sí cascada.
        r = await client.post(
            f"/api/v1/me/deliverables/{dz}/comments",
            json={"type": "aprobacion", "content": "ok"},
            headers=rh,
        )
        assert r.status_code == 201, r.text
        await db_session.refresh(t1)
        await db_session.refresh(t2)
        assert t1.status == TaskStatus.COMPLETADA
        assert t2.start_date == T1_DUE
        assert t2.due_date == T1_DUE + timedelta(days=3)
