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


async def _make_task(db, team_id, assignee_id) -> Task:
    """Crea una Task delegada al equipo, con su árbol mínimo (proyecto + módulo)."""
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
        work_item_id=modulo.id,
        team_id=team_id,
        assignee_id=assignee_id,
        start_date=date.today(),
        due_date=date.today() + timedelta(days=5),
        status=TaskStatus.PENDIENTE_POR_INICIAR,
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

        db_session.add(Team(id=other_team_id, name=f"Otro {uuid4()}"))
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
