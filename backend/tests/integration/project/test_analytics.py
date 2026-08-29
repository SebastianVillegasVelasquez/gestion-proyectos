"""Analítica del informe interactivo (fase 6.1).

Métricas en días laborables sobre `task_history`. Las fechas del seed están
fijadas a días concretos de la semana para poder verificar los días hábiles
exactos.
"""

import datetime
import uuid

import pytest_asyncio

from app.modules.identity.infrastructure.enums import SystemRole, UserPosition
from app.modules.identity.infrastructure.models import User
from app.modules.project.infrastructure.models import Project
from app.modules.project.structure.infrastructure.models import TipoNodo, WorkItem
from app.modules.tasks.infrastructure.enums import HistoryAction, TaskStatus
from app.modules.tasks.infrastructure.models import Task, TaskHistory

UTC = datetime.timezone.utc

# Todos lunes salvo que se diga (marzo 2026: 2, 9, 16, 23 son lunes; 20 viernes).
MON_2 = datetime.date(2026, 3, 2)
MON_9 = datetime.date(2026, 3, 9)
MON_16 = datetime.date(2026, 3, 16)
WED_18 = datetime.date(2026, 3, 18)
FRI_20 = datetime.date(2026, 3, 20)
WED_11 = datetime.date(2026, 3, 11)
THU_5 = datetime.date(2026, 3, 5)


def _dt(d: datetime.date) -> datetime.datetime:
    return datetime.datetime(d.year, d.month, d.day, 12, 0, tzinfo=UTC)


async def _user(db, name):
    u = User(
        id=uuid.uuid4(),
        email=f"{name}-{uuid.uuid4()}@t.com",
        password="x",
        name=name,
        last_name="Test",
        role=SystemRole.USER,
        position=UserPosition.DESARROLLADOR,
        is_active=True,
    )
    db.add(u)
    await db.flush()
    return u


def _status_event(task_id, old, new, when):
    return TaskHistory(
        id=uuid.uuid4(),
        task_id=task_id,
        action=HistoryAction.CAMBIO_ESTADO,
        old_status=old,
        new_status=new,
        created_at=_dt(when),
    )


@pytest_asyncio.fixture
async def analytics_project(db_session):
    project = Project(
        id=uuid.uuid4(),
        name="Proyecto Analítica",
        description="seed",
        start_date=MON_2,
        end_date=datetime.date(2026, 4, 30),
    )
    db_session.add(project)
    await db_session.flush()

    tipo = TipoNodo(id=uuid.uuid4(), proyecto_id=project.id, nombre="Unidad")
    db_session.add(tipo)
    await db_session.flush()
    node = WorkItem(
        id=uuid.uuid4(),
        proyecto_id=project.id,
        tipo_id=tipo.id,
        nombre="Unidad 1",
        orden=0,
    )
    db_session.add(node)
    await db_session.flush()

    ana = await _user(db_session, "Ana")
    beto = await _user(db_session, "Beto")

    def task(title, status, assignee, due, start=MON_2):
        return Task(
            id=uuid.uuid4(),
            title=title,
            status=status,
            project_id=project.id,
            work_item_id=node.id,
            assignee_id=assignee.id if assignee else None,
            start_date=start,
            due_date=due,
        )

    a = task("A produce y revisa", TaskStatus.COMPLETADA, ana, WED_11)
    b = task("B en progreso", TaskStatus.EN_PROGRESO, ana, MON_16)
    c = task("C con devolución", TaskStatus.COMPLETADA, beto, WED_18)
    d = task("D cancelada", TaskStatus.CANCELADA, None, MON_16)
    db_session.add_all([a, b, c, d])
    await db_session.flush()

    db_session.add_all(
        [
            # A: en_progreso lun2 -> en_revision lun9 (prod 5) -> completada lun16
            #    (review 5, cycle 10). due mié11 -> cerró +3 días laborables tarde.
            _status_event(
                a.id, TaskStatus.PENDIENTE_POR_INICIAR, TaskStatus.EN_PROGRESO, MON_2
            ),
            _status_event(a.id, TaskStatus.EN_PROGRESO, TaskStatus.EN_REVISION, MON_9),
            _status_event(a.id, TaskStatus.EN_REVISION, TaskStatus.COMPLETADA, MON_16),
            # B: solo arranca.
            _status_event(
                b.id, TaskStatus.PENDIENTE_POR_INICIAR, TaskStatus.EN_PROGRESO, MON_2
            ),
            # C: en_progreso lun2 -> devuelta jue5 -> en_progreso lun9 -> completada vie20.
            #    due mié18 -> cerró +2 días laborables tarde. Cuenta como retrabajo.
            _status_event(
                c.id, TaskStatus.PENDIENTE_POR_INICIAR, TaskStatus.EN_PROGRESO, MON_2
            ),
            _status_event(c.id, TaskStatus.EN_PROGRESO, TaskStatus.DEVUELTA, THU_5),
            _status_event(c.id, TaskStatus.DEVUELTA, TaskStatus.EN_PROGRESO, MON_9),
            _status_event(c.id, TaskStatus.EN_PROGRESO, TaskStatus.COMPLETADA, FRI_20),
        ]
    )
    await db_session.commit()
    return project, ana, beto


class TestProjectAnalytics:
    async def test_requires_admin(self, client, member_headers, analytics_project):
        project, *_ = analytics_project
        r = await client.get(
            f"/api/v1/projects/{project.id}/analytics", headers=member_headers
        )
        assert r.status_code == 403

    async def test_overview_metrics(self, client, admin_headers, analytics_project):
        project, *_ = analytics_project
        r = await client.get(
            f"/api/v1/projects/{project.id}/analytics", headers=admin_headers
        )
        assert r.status_code == 200, r.text
        ov = r.json()["overview"]

        assert ov["total_tasks"] == 4
        assert ov["by_status"] == {
            "completada": 2,
            "en_progreso": 1,
            "cancelada": 1,
        }
        # 2 completadas de 3 no canceladas.
        assert ov["progress_pct"] == 67
        # C pasó por 'devuelta': 1 de 4.
        assert ov["rework_rate_pct"] == 25.0
        # Desviación media: A +3, C +2 días laborables -> 2.5.
        assert ov["avg_schedule_slip_bdays"] == 2.5
        # Cycle time: A=10, C=14 días laborables.
        assert ov["cycle_time_p50_bdays"] == 12.0
        assert ov["cycle_time_p90_bdays"] > 12.0

    async def test_burnup_scope_excludes_cancelled(
        self, client, admin_headers, analytics_project
    ):
        project, *_ = analytics_project
        r = await client.get(
            f"/api/v1/projects/{project.id}/analytics", headers=admin_headers
        )
        burnup = r.json()["burnup"]
        assert burnup["total_scope"] == 3
        assert len(burnup["points"]) > 0
        assert burnup["points"][-1]["actual"] == 2  # A y C cerradas

    async def test_delivery_lapses_only_tasks_that_moved_to_review(
        self, client, admin_headers, analytics_project
    ):
        project, *_ = analytics_project
        r = await client.get(
            f"/api/v1/projects/{project.id}/analytics", headers=admin_headers
        )
        lapses = r.json()["delivery_lapses"]
        # Solo A llegó a 'en_revision' y no tiene entregable con versiones.
        assert [x["task_title"] for x in lapses] == ["A produce y revisa"]
        assert lapses[0]["production_bdays"] == 5
        assert lapses[0]["review_bdays"] == 5
        assert lapses[0]["total_bdays"] == 10
        assert lapses[0]["element_path"] == ["Unidad 1"]

    async def test_by_person_split(self, client, admin_headers, analytics_project):
        project, ana, beto = analytics_project
        r = await client.get(
            f"/api/v1/projects/{project.id}/analytics", headers=admin_headers
        )
        people = {p["name"]: p for p in r.json()["by_person"]}
        assert people["Ana Test"]["completed"] == 1
        assert people["Beto Test"]["completed"] == 1
        assert people["Beto Test"]["returns_received"] == 1  # su tarea fue devuelta

    async def test_html_export_is_a_self_contained_attachment(
        self, client, admin_headers, analytics_project
    ):
        project, *_ = analytics_project
        r = await client.get(
            f"/api/v1/projects/{project.id}/analytics.html", headers=admin_headers
        )
        assert r.status_code == 200, r.text
        assert r.headers["content-type"].startswith("text/html")
        assert "attachment" in r.headers["content-disposition"]
        assert ".html" in r.headers["content-disposition"]
        body = r.text
        assert body.startswith("<!doctype html>")
        assert "Proyecto Analítica" in body
        # Sin recursos externos: nada de http(s):// en src/href.
        assert 'src="http' not in body and 'href="http' not in body
        # Trae las secciones ("vistas") y una métrica calculada.
        assert "Rendimiento por equipo" in body
        assert "Retrabajo" in body

    async def test_filter_by_assignee(self, client, admin_headers, analytics_project):
        project, ana, beto = analytics_project
        r = await client.get(
            f"/api/v1/projects/{project.id}/analytics",
            params={"assignee_id": str(ana.id)},
            headers=admin_headers,
        )
        ov = r.json()["overview"]
        assert ov["total_tasks"] == 2  # A y B
        assert r.json()["filters"]["assignee_id"] == str(ana.id)
