"""Fase 2: entregable ↔ Task real. Aprobar / rechazar mueve Task.status y
deja rastro en TaskHistory (trazabilidad).
"""

from datetime import date, timedelta
from uuid import uuid4

from sqlalchemy import select

from app.modules.tasks.infrastructure.enums import HistoryAction, TaskStatus
from app.modules.tasks.infrastructure.models import Task, TaskHistory
from app.modules.project.infrastructure.models import Project
from app.modules.project.structure.infrastructure.models import TipoNodo, WorkItem

# Reutiliza el escenario ya montado (equipo con integrante + líder + admin).
from tests.integration.teams.test_workspace import scenario  # noqa: F401


async def _make_task(db, team_id, assignee_id, requires_approval=True) -> Task:
    """Crea una Task delegada al equipo, con su árbol mínimo (proyecto + módulo).

    `requires_approval=True` por defecto: la mayoría de tests de este archivo
    ejercitan el flujo CLÁSICO con revisión del líder. Los que ejercitan el
    entregable "sin aprobación" lo piden explícito con `requires_approval=False`.
    """
    project = Project(
        name=f"Proj {uuid4()}",
        description="Fase 2",
        client_name="Test",
        start_date=date.today(),
        end_date=date.today() + timedelta(days=60),
    )
    db.add(project)
    await db.flush()
    tipo = TipoNodo(proyecto_id=project.id, nombre="Módulo")
    db.add(tipo)
    await db.flush()
    modulo = WorkItem(
        proyecto_id=project.id, tipo_id=tipo.id, nombre="Módulo 1", orden=0
    )
    db.add(modulo)
    await db.flush()
    task = Task(
        title="Banner del Módulo 1",
        project_id=project.id,
        work_item_id=modulo.id,
        team_id=team_id,
        assignee_id=assignee_id,
        start_date=date.today(),
        due_date=date.today() + timedelta(days=5),
        status=TaskStatus.PENDIENTE_POR_INICIAR,
        requires_approval=requires_approval,
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


async def _headers_for(user):
    from app.core.security import create_access_token

    return {
        "Authorization": f"Bearer {create_access_token(user_id=user.id, role=user.role.value)}"
    }


async def _history_for(db, task_id) -> list[TaskHistory]:
    rows = await db.execute(
        select(TaskHistory)
        .where(TaskHistory.task_id == task_id)
        .order_by(TaskHistory.created_at)
    )
    return list(rows.scalars().all())


class TestDeliverableLinkedToTask:
    async def test_deliver_moves_task_to_en_revision_and_records_history(
        self, client, scenario, db_session
    ):
        s = scenario
        task = await _make_task(db_session, s.team.id, s.integrante.id)
        integrante_h = await _headers_for(s.integrante)

        # Crear entregable vinculado a la Task.
        created = await client.post(
            f"/api/v1/teams/{s.team.id}/deliverables",
            json={
                "task_title": task.title,
                "assignee_id": str(s.integrante.id),
                "task_id": str(task.id),
            },
            headers=integrante_h,
        )
        assert created.status_code == 201, created.text
        assert created.json()["task_id"] == str(task.id)

        # Entregar (subir versión) → la Task pasa a "en revisión".
        deliverable_id = created.json()["id"]
        version = await client.post(
            f"/api/v1/teams/{s.team.id}/deliverables/{deliverable_id}/versions",
            json={"type": "enlace", "url": "https://ejemplo.com/banner"},
            headers=integrante_h,
        )
        assert version.status_code == 201, version.text

        await db_session.refresh(task)
        assert task.status == TaskStatus.EN_REVISION

        history = await _history_for(db_session, task.id)
        assert len(history) == 1
        assert history[0].action == HistoryAction.CAMBIO_ESTADO
        assert history[0].new_status == TaskStatus.EN_REVISION
        assert history[0].changed_by_id == s.integrante.id

    async def test_approve_marks_task_completed(self, client, scenario, db_session):
        s = scenario
        task = await _make_task(db_session, s.team.id, s.integrante.id)
        integrante_h = await _headers_for(s.integrante)
        lider_h = await _headers_for(s.lider)

        deliverable_id = (
            await client.post(
                f"/api/v1/teams/{s.team.id}/deliverables",
                json={
                    "task_title": task.title,
                    "assignee_id": str(s.integrante.id),
                    "task_id": str(task.id),
                },
                headers=integrante_h,
            )
        ).json()["id"]
        await client.post(
            f"/api/v1/teams/{s.team.id}/deliverables/{deliverable_id}/versions",
            json={"type": "enlace", "url": "https://ejemplo.com"},
            headers=integrante_h,
        )

        approved = await client.post(
            f"/api/v1/teams/{s.team.id}/deliverables/{deliverable_id}/comments",
            json={"content": "Todo bien, aprobado", "type": "aprobacion"},
            headers=lider_h,
        )
        assert approved.status_code == 201, approved.text

        await db_session.refresh(task)
        assert task.status == TaskStatus.COMPLETADA
        assert task.completed_at is not None

        history = await _history_for(db_session, task.id)
        # 2 eventos: entrega (en_revision) + aprobación (completada).
        assert [h.new_status for h in history] == [
            TaskStatus.EN_REVISION,
            TaskStatus.COMPLETADA,
        ]
        assert history[-1].changed_by_id == s.lider.id

    async def test_reject_returns_task_with_reason_in_history(
        self, client, scenario, db_session
    ):
        s = scenario
        task = await _make_task(db_session, s.team.id, s.integrante.id)
        integrante_h = await _headers_for(s.integrante)
        lider_h = await _headers_for(s.lider)

        deliverable_id = (
            await client.post(
                f"/api/v1/teams/{s.team.id}/deliverables",
                json={
                    "task_title": task.title,
                    "assignee_id": str(s.integrante.id),
                    "task_id": str(task.id),
                },
                headers=integrante_h,
            )
        ).json()["id"]
        await client.post(
            f"/api/v1/teams/{s.team.id}/deliverables/{deliverable_id}/versions",
            json={"type": "enlace", "url": "https://ejemplo.com"},
            headers=integrante_h,
        )

        rejection_reason = "Faltan las variantes del banner"
        await client.post(
            f"/api/v1/teams/{s.team.id}/deliverables/{deliverable_id}/comments",
            json={"content": rejection_reason, "type": "solicitud_cambio"},
            headers=lider_h,
        )

        await db_session.refresh(task)
        assert task.status == TaskStatus.DEVUELTA
        assert task.completed_at is None

        history = await _history_for(db_session, task.id)
        assert history[-1].new_status == TaskStatus.DEVUELTA
        assert history[-1].change_reason == rejection_reason

    async def test_cannot_link_deliverable_to_task_of_other_team(
        self, client, scenario, db_session
    ):
        s = scenario
        # Task delegada a OTRO equipo distinto al del scenario.
        other_team_id = uuid4()
        from app.modules.teams.infrastructure.models import Team

        other_project = Project(
            name=f"Proj {uuid4()}",
            description="Otro proyecto",
            client_name="Test",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=60),
        )
        db_session.add(other_project)
        await db_session.flush()
        db_session.add(
            Team(id=other_team_id, project_id=other_project.id, name=f"Otro {uuid4()}")
        )
        await db_session.commit()
        task = await _make_task(db_session, other_team_id, s.integrante.id)
        integrante_h = await _headers_for(s.integrante)

        rejected = await client.post(
            f"/api/v1/teams/{s.team.id}/deliverables",
            json={
                "task_title": task.title,
                "assignee_id": str(s.integrante.id),
                "task_id": str(task.id),
            },
            headers=integrante_h,
        )
        assert rejected.status_code == 422
        assert "no está delegada a este equipo" in rejected.json()["detail"]

    async def test_deliverable_without_task_still_works(
        self, client, scenario, db_session
    ):
        """Retrocompatibilidad: el flujo antiguo (sin task_id) no debe romperse."""
        s = scenario
        integrante_h = await _headers_for(s.integrante)

        created = await client.post(
            f"/api/v1/teams/{s.team.id}/deliverables",
            json={"task_title": "Trabajo suelto", "assignee_id": str(s.integrante.id)},
            headers=integrante_h,
        )
        assert created.status_code == 201, created.text
        assert created.json()["task_id"] is None


class TestDeliveryBlockedByDependency:
    """Entregar mueve el estado de la tarea sin pasar por
    `ChangeTaskStatusUseCase`; la compuerta finish-to-start tiene que aplicarse
    también en la entrega, si no se puede entregar trabajo que depende de algo
    que aún no está listo."""

    async def test_cannot_deliver_while_a_task_dependency_is_open(
        self, client, scenario, db_session
    ):
        from app.modules.tasks.infrastructure.models import TaskDependency

        s = scenario
        pred = await _make_task(db_session, s.team.id, s.integrante.id)
        succ = await _make_task(db_session, s.team.id, s.integrante.id)
        db_session.add(TaskDependency(task_id=succ.id, depends_on_id=pred.id))
        await db_session.commit()

        integrante_h = await _headers_for(s.integrante)
        del_id = (
            await client.post(
                f"/api/v1/teams/{s.team.id}/deliverables",
                json={
                    "task_title": succ.title,
                    "assignee_id": str(s.integrante.id),
                    "task_id": str(succ.id),
                },
                headers=integrante_h,
            )
        ).json()["id"]

        blocked = await client.post(
            f"/api/v1/teams/{s.team.id}/deliverables/{del_id}/versions",
            json={"type": "enlace", "url": "https://ejemplo.com"},
            headers=integrante_h,
        )
        assert blocked.status_code == 422, blocked.text

        # Completada la predecesora, la entrega ya pasa.
        pred.status = TaskStatus.COMPLETADA
        await db_session.commit()
        ok = await client.post(
            f"/api/v1/teams/{s.team.id}/deliverables/{del_id}/versions",
            json={"type": "enlace", "url": "https://ejemplo.com"},
            headers=integrante_h,
        )
        assert ok.status_code == 201, ok.text

    async def test_cannot_deliver_under_an_undelivered_third_party_activity(
        self, client, scenario, db_session
    ):
        s = scenario
        project = Project(
            name=f"Proj {uuid4()}",
            description="tercero",
            client_name="Test",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=60),
        )
        db_session.add(project)
        await db_session.flush()
        tercero_tipo = TipoNodo(proyecto_id=project.id, nombre="Actividad de terceros")
        modulo_tipo = TipoNodo(proyecto_id=project.id, nombre="Módulo")
        db_session.add_all([tercero_tipo, modulo_tipo])
        await db_session.flush()
        tercero = WorkItem(
            proyecto_id=project.id,
            tipo_id=tercero_tipo.id,
            nombre="Entrega del proveedor",
            orden=0,
        )
        db_session.add(tercero)
        await db_session.flush()
        hijo = WorkItem(
            proyecto_id=project.id,
            tipo_id=modulo_tipo.id,
            nombre="Depende del proveedor",
            orden=0,
            parent_id=tercero.id,
        )
        db_session.add(hijo)
        await db_session.flush()
        task = Task(
            title="Trabajo que cuelga del tercero",
            project_id=project.id,
            work_item_id=hijo.id,
            team_id=s.team.id,
            assignee_id=s.integrante.id,
            status=TaskStatus.PENDIENTE_POR_INICIAR,
            requires_approval=False,
        )
        db_session.add(task)
        await db_session.commit()

        integrante_h = await _headers_for(s.integrante)
        del_id = (
            await client.post(
                f"/api/v1/teams/{s.team.id}/deliverables",
                json={
                    "task_title": task.title,
                    "assignee_id": str(s.integrante.id),
                    "task_id": str(task.id),
                },
                headers=integrante_h,
            )
        ).json()["id"]

        blocked = await client.post(
            f"/api/v1/teams/{s.team.id}/deliverables/{del_id}/versions",
            json={"type": "enlace", "url": "https://ejemplo.com"},
            headers=integrante_h,
        )
        assert blocked.status_code == 422, blocked.text

        # El tercero entrega (fecha real) → ya no bloquea.
        tercero.fecha_fin_real = date.today()
        await db_session.commit()
        ok = await client.post(
            f"/api/v1/teams/{s.team.id}/deliverables/{del_id}/versions",
            json={"type": "enlace", "url": "https://ejemplo.com"},
            headers=integrante_h,
        )
        assert ok.status_code == 201, ok.text


class TestDeliverableWithoutApprovalAutoCompletes:
    """`requires_approval=False` (el default): entregar completa la tarea
    directo, sin pasar por el líder — ni notificación de revisión pendiente."""

    async def test_delivering_completes_the_task_without_review(
        self, client, scenario, db_session
    ):
        from sqlalchemy import select

        from app.modules.notifications.infrastructure.models import Notification

        s = scenario
        task = await _make_task(
            db_session, s.team.id, s.integrante.id, requires_approval=False
        )
        integrante_h = await _headers_for(s.integrante)

        deliverable_id = (
            await client.post(
                f"/api/v1/teams/{s.team.id}/deliverables",
                json={
                    "task_title": task.title,
                    "assignee_id": str(s.integrante.id),
                    "task_id": str(task.id),
                },
                headers=integrante_h,
            )
        ).json()["id"]

        version = await client.post(
            f"/api/v1/teams/{s.team.id}/deliverables/{deliverable_id}/versions",
            json={"type": "enlace", "url": "https://ejemplo.com/banner"},
            headers=integrante_h,
        )
        assert version.status_code == 201, version.text
        assert version.json()["status"] == "aprobado"

        await db_session.refresh(task)
        assert task.status == TaskStatus.COMPLETADA
        assert task.completed_at is not None

        history = await _history_for(db_session, task.id)
        assert [h.new_status for h in history] == [TaskStatus.COMPLETADA]

        # Nadie revisa: el líder no recibe el aviso de "hay una entrega pendiente".
        rows = (await db_session.execute(select(Notification))).scalars().all()
        to_lider = [n for n in rows if n.user_to_id == s.lider.id]
        assert to_lider == []

    async def test_leader_can_still_reopen_it_afterwards(
        self, client, scenario, db_session
    ):
        """El líder puede cambiar el estado en cualquier momento, aprobación
        obligatoria o no: pedir cambios devuelve la tarea igual que siempre."""
        s = scenario
        task = await _make_task(
            db_session, s.team.id, s.integrante.id, requires_approval=False
        )
        integrante_h = await _headers_for(s.integrante)
        lider_h = await _headers_for(s.lider)

        deliverable_id = (
            await client.post(
                f"/api/v1/teams/{s.team.id}/deliverables",
                json={
                    "task_title": task.title,
                    "assignee_id": str(s.integrante.id),
                    "task_id": str(task.id),
                },
                headers=integrante_h,
            )
        ).json()["id"]
        await client.post(
            f"/api/v1/teams/{s.team.id}/deliverables/{deliverable_id}/versions",
            json={"type": "enlace", "url": "https://ejemplo.com"},
            headers=integrante_h,
        )

        reopened = await client.post(
            f"/api/v1/teams/{s.team.id}/deliverables/{deliverable_id}/comments",
            json={"content": "En realidad falta algo", "type": "solicitud_cambio"},
            headers=lider_h,
        )
        assert reopened.status_code == 201, reopened.text
        assert reopened.json()["status"] == "cambios_solicitados"

        await db_session.refresh(task)
        assert task.status == TaskStatus.DEVUELTA


class TestDeliverableOwnershipRules:
    """Solo el responsable de la tarea entrega, corrige o borra su entregable;
    y solo hay un entregable vivo por tarea."""

    async def test_cannot_create_a_deliverable_assigned_to_someone_else(
        self, client, scenario
    ):
        s = scenario
        r = await client.post(
            f"/api/v1/teams/{s.team.id}/deliverables",
            json={"task_title": "No es mío", "assignee_id": str(s.lider.id)},
            headers=await _headers_for(s.integrante),
        )
        assert r.status_code == 403, r.text

    async def test_cannot_create_a_deliverable_for_a_task_assigned_to_someone_else(
        self, client, scenario, db_session
    ):
        s = scenario
        task = await _make_task(db_session, s.team.id, s.lider.id)
        r = await client.post(
            f"/api/v1/teams/{s.team.id}/deliverables",
            json={
                "task_title": task.title,
                "assignee_id": str(s.integrante.id),
                "task_id": str(task.id),
            },
            headers=await _headers_for(s.integrante),
        )
        assert r.status_code == 403, r.text

    async def test_cannot_create_a_second_deliverable_for_the_same_task(
        self, client, scenario, db_session
    ):
        s = scenario
        task = await _make_task(db_session, s.team.id, s.integrante.id)
        integrante_h = await _headers_for(s.integrante)
        payload = {
            "task_title": task.title,
            "assignee_id": str(s.integrante.id),
            "task_id": str(task.id),
        }
        first = await client.post(
            f"/api/v1/teams/{s.team.id}/deliverables",
            json=payload,
            headers=integrante_h,
        )
        assert first.status_code == 201, first.text

        second = await client.post(
            f"/api/v1/teams/{s.team.id}/deliverables",
            json=payload,
            headers=integrante_h,
        )
        assert second.status_code == 422, second.text

    async def test_only_the_owner_can_add_a_version(self, client, scenario):
        s = scenario
        del_id = (
            await client.post(
                f"/api/v1/teams/{s.team.id}/deliverables",
                json={"task_title": "Prototipo", "assignee_id": str(s.integrante.id)},
                headers=await _headers_for(s.integrante),
            )
        ).json()["id"]

        r = await client.post(
            f"/api/v1/teams/{s.team.id}/deliverables/{del_id}/versions",
            json={"type": "enlace", "url": "https://ejemplo.com"},
            headers=await _headers_for(s.lider),
        )
        assert r.status_code == 403, r.text

    async def test_owner_can_delete_before_approval(self, client, scenario):
        s = scenario
        integrante_h = await _headers_for(s.integrante)
        del_id = (
            await client.post(
                f"/api/v1/teams/{s.team.id}/deliverables",
                json={"task_title": "Prototipo", "assignee_id": str(s.integrante.id)},
                headers=integrante_h,
            )
        ).json()["id"]

        deleted = await client.delete(
            f"/api/v1/teams/{s.team.id}/deliverables/{del_id}", headers=integrante_h
        )
        assert deleted.status_code == 204, deleted.text

        listed = await client.get(
            f"/api/v1/teams/{s.team.id}/deliverables/{del_id}", headers=integrante_h
        )
        assert listed.status_code == 404

    async def test_cannot_delete_someone_elses_deliverable(self, client, scenario):
        s = scenario
        del_id = (
            await client.post(
                f"/api/v1/teams/{s.team.id}/deliverables",
                json={"task_title": "Prototipo", "assignee_id": str(s.integrante.id)},
                headers=await _headers_for(s.integrante),
            )
        ).json()["id"]

        r = await client.delete(
            f"/api/v1/teams/{s.team.id}/deliverables/{del_id}",
            headers=await _headers_for(s.lider),
        )
        assert r.status_code == 403, r.text

    async def test_cannot_delete_an_approved_deliverable(
        self, client, scenario, db_session
    ):
        s = scenario
        task = await _make_task(
            db_session, s.team.id, s.integrante.id, requires_approval=False
        )
        integrante_h = await _headers_for(s.integrante)
        del_id = (
            await client.post(
                f"/api/v1/teams/{s.team.id}/deliverables",
                json={
                    "task_title": task.title,
                    "assignee_id": str(s.integrante.id),
                    "task_id": str(task.id),
                },
                headers=integrante_h,
            )
        ).json()["id"]
        await client.post(
            f"/api/v1/teams/{s.team.id}/deliverables/{del_id}/versions",
            json={"type": "enlace", "url": "https://ejemplo.com"},
            headers=integrante_h,
        )  # auto-aprobado (requires_approval=False)

        r = await client.delete(
            f"/api/v1/teams/{s.team.id}/deliverables/{del_id}", headers=integrante_h
        )
        assert r.status_code == 422, r.text
