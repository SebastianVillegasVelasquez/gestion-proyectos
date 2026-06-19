"""Datos de demostración para el entorno de desarrollo.

Crea un proyecto completo (árbol de trabajo flexible, equipo y tareas con
dependencias y fechas variadas) para ver las vistas con datos reales.
Idempotente: si el proyecto demo ya existe, no hace nada.
"""

import datetime
import uuid

import app.core.models_registry  # noqa: F401 - registra los mappers ORM
from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.core.logger import get_logger
from app.core.security import hash_password
from app.modules.identity.infrastructure.enums import SystemRole, UserPosition
from app.modules.identity.infrastructure.models import User
from app.modules.project.infrastructure.enums import ProjectRole
from app.modules.project.infrastructure.models import Project, ProjectMember
from app.modules.project.structure.infrastructure.models import TipoNodo, WorkItem
from app.modules.tasks.infrastructure.enums import (
    HistoryAction,
    TaskPriority,
    TaskStatus,
)
from app.modules.tasks.infrastructure.models import Task, TaskDependency, TaskHistory

logger = get_logger(__name__)

DEMO_PROJECT_NAME = "Diplomado en Transformación Digital"

_DEMO_USERS = [
    ("maria.dev@objdigital.com", "María", "Restrepo", UserPosition.DESARROLLADOR),
    (
        "juan.diseno@objdigital.com",
        "Juan",
        "Gómez",
        UserPosition.DISENADOR_INSTRUCCIONAL,
    ),
    ("ana.experta@objdigital.com", "Ana", "López", UserPosition.EXPERTO_TEMATICO),
]


async def _ensure_user(session, email, name, last_name, position) -> User:
    from sqlalchemy import select

    existing = (
        (await session.execute(select(User).where(User.email == email)))
        .scalars()
        .first()
    )
    if existing:
        return existing
    user = User(
        email=email,
        password=hash_password("Demo1234*"),
        name=name,
        last_name=last_name,
        role=SystemRole.USER,
        position=position,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    return user


async def ensure_demo_data() -> None:
    settings = get_settings()
    if not settings.IS_DEV:
        return
    try:
        from sqlalchemy import select

        async with AsyncSessionLocal() as session:
            exists = (
                await session.execute(
                    select(Project.id).where(Project.name == DEMO_PROJECT_NAME)
                )
            ).first()
            if exists:
                logger.info("Datos demo ya presentes; no se recrean")
                return

            today = datetime.date.today()
            users = [await _ensure_user(session, *u) for u in _DEMO_USERS]
            lead = (
                (
                    await session.execute(
                        select(User).where(User.email == settings.SUPERADMIN_EMAIL)
                    )
                )
                .scalars()
                .first()
            )

            project = Project(
                id=uuid.uuid4(),
                name=DEMO_PROJECT_NAME,
                description="Virtualización de un diplomado, en árbol flexible.",
                client_name="Universidad OBJ",
                start_date=today - datetime.timedelta(days=20),
                end_date=today + datetime.timedelta(days=60),
                progress_pct=35.0,
            )
            session.add(project)
            await session.flush()

            if lead:
                session.add(
                    ProjectMember(
                        project_id=project.id,
                        user_id=lead.id,
                        project_role=ProjectRole.COORDINADOR,
                    )
                )
            for user, role in zip(
                users,
                [ProjectRole.INTEGRANTE, ProjectRole.REVISOR, ProjectRole.INTEGRANTE],
            ):
                session.add(
                    ProjectMember(
                        project_id=project.id, user_id=user.id, project_role=role
                    )
                )

            # Tipos de nodo del proyecto (catálogo flexible).
            t_fase = TipoNodo(id=uuid.uuid4(), proyecto_id=project.id, nombre="Fase")
            t_modulo = TipoNodo(
                id=uuid.uuid4(), proyecto_id=project.id, nombre="Módulo"
            )
            session.add_all([t_fase, t_modulo])
            await session.flush()

            # Árbol: 3 fases en paralelo; la fase de Producción tiene 3 módulos.
            def fase(nombre, orden, dur):
                return WorkItem(
                    id=uuid.uuid4(),
                    proyecto_id=project.id,
                    tipo_id=t_fase.id,
                    nombre=nombre,
                    orden=orden,
                    duracion_valor=dur,
                    duracion_unidad="dias",
                )

            f_planeacion = fase("Planeación", 0, 15)
            f_produccion = fase("Producción", 1, 30)
            f_publicacion = fase("Publicación", 2, 10)
            session.add_all([f_planeacion, f_produccion, f_publicacion])
            await session.flush()

            modulos = [
                WorkItem(
                    id=uuid.uuid4(),
                    proyecto_id=project.id,
                    parent_id=f_produccion.id,
                    tipo_id=t_modulo.id,
                    nombre=f"Unidad {i}",
                    orden=i - 1,
                )
                for i in (1, 2, 3)
            ]
            session.add_all(modulos)
            await session.flush()

            # Tareas con fechas variadas y una dependencia FtS.
            def task(
                title,
                *,
                work_item_id,
                assignee,
                status,
                start_offset,
                dur,
                priority=TaskPriority.MEDIA,
                done=False,
            ):
                start = today + datetime.timedelta(days=start_offset)
                t = Task(
                    id=uuid.uuid4(),
                    title=title,
                    status=status,
                    priority=priority,
                    work_item_id=work_item_id,
                    assignee_id=assignee,
                    start_date=start,
                    due_date=start + datetime.timedelta(days=dur),
                    completed_at=(
                        datetime.datetime.now(datetime.timezone.utc) if done else None
                    ),
                )
                session.add(t)
                return t

            t_plan = task(
                "Definir cronograma y alcance",
                work_item_id=f_planeacion.id,
                assignee=users[1].id,
                status=TaskStatus.COMPLETADA,
                start_offset=-18,
                dur=10,
                done=True,
            )
            task(
                "Aprobar plan con el cliente",
                work_item_id=f_planeacion.id,
                assignee=lead.id if lead else None,
                status=TaskStatus.EN_REVISION,
                start_offset=-6,
                dur=8,
                priority=TaskPriority.ALTA,
            )
            # Vencida: debía terminar hace días y sigue en progreso.
            task(
                "Guion de la Unidad 1",
                work_item_id=modulos[0].id,
                assignee=users[2].id,
                status=TaskStatus.EN_PROGRESO,
                start_offset=-10,
                dur=4,
                priority=TaskPriority.URGENTE,
            )
            dev_task = task(
                "Maquetar Unidad 1 en LMS",
                work_item_id=modulos[0].id,
                assignee=users[0].id,
                status=TaskStatus.PENDIENTE_POR_INICIAR,
                start_offset=2,
                dur=6,
            )
            task(
                "Guion de la Unidad 2",
                work_item_id=modulos[1].id,
                assignee=users[2].id,
                status=TaskStatus.PENDIENTE_POR_INICIAR,
                start_offset=5,
                dur=4,
            )
            task(
                "Publicación final",
                work_item_id=f_publicacion.id,
                assignee=lead.id if lead else None,
                status=TaskStatus.PENDIENTE_POR_INICIAR,
                start_offset=45,
                dur=8,
            )

            await session.flush()
            session.add(TaskDependency(task_id=dev_task.id, depends_on_id=t_plan.id))
            await session.commit()
            logger.info("Datos demo creados", project=DEMO_PROJECT_NAME)
    except Exception as exc:  # noqa: BLE001
        logger.warning("No se pudo sembrar la data demo", error=str(exc))


def _at(day: datetime.date, hour: int = 9) -> datetime.datetime:
    return datetime.datetime.combine(
        day, datetime.time(hour), tzinfo=datetime.timezone.utc
    )


async def ensure_demo_traceability() -> None:
    """Siembra historial de trazabilidad para el proyecto demo (idempotente)."""
    settings = get_settings()
    if not settings.IS_DEV:
        return
    try:
        from sqlalchemy import select

        async with AsyncSessionLocal() as session:
            project_id = (
                await session.execute(
                    select(Project.id).where(Project.name == DEMO_PROJECT_NAME)
                )
            ).scalar_one_or_none()
            if not project_id:
                return

            # Tareas del proyecto vía su WorkItem.
            tasks = (
                (
                    await session.execute(
                        select(Task)
                        .join(WorkItem, Task.work_item_id == WorkItem.id)
                        .where(
                            Task.deleted_at.is_(None),
                            WorkItem.proyecto_id == project_id,
                        )
                    )
                )
                .scalars()
                .all()
            )
            if not tasks:
                return

            task_ids = [t.id for t in tasks]
            already = (
                await session.execute(
                    select(TaskHistory.id)
                    .where(TaskHistory.task_id.in_(task_ids))
                    .limit(1)
                )
            ).first()
            if already:
                logger.info("Historial demo ya presente; no se recrea")
                return

            lead = (
                (
                    await session.execute(
                        select(User).where(User.email == settings.SUPERADMIN_EMAIL)
                    )
                )
                .scalars()
                .first()
            )
            lead_id = lead.id if lead else None
            today = datetime.date.today()

            def evt(task, action, old, new, when, actor_id, reason=None):
                session.add(
                    TaskHistory(
                        id=uuid.uuid4(),
                        task_id=task.id,
                        changed_by_id=actor_id,
                        action=action,
                        old_status=old,
                        new_status=new,
                        change_reason=reason,
                        created_at=when,
                    )
                )

            for t in tasks:
                actor = t.assignee_id or lead_id
                start, due = t.start_date, t.due_date

                evt(
                    t,
                    HistoryAction.CREACION,
                    None,
                    None,
                    _at(start, 8),
                    lead_id,
                    "Tarea creada",
                )
                if t.assignee_id:
                    evt(
                        t,
                        HistoryAction.REASIGNACION,
                        None,
                        None,
                        _at(start, 9),
                        lead_id,
                        "Asignación inicial del responsable",
                    )

                if t.status in (
                    TaskStatus.EN_PROGRESO,
                    TaskStatus.EN_REVISION,
                    TaskStatus.COMPLETADA,
                ):
                    evt(
                        t,
                        HistoryAction.CAMBIO_ESTADO,
                        TaskStatus.PENDIENTE_POR_INICIAR,
                        TaskStatus.EN_PROGRESO,
                        _at(start, 10),
                        actor,
                        "Inicia ejecución",
                    )
                if t.status in (TaskStatus.EN_REVISION, TaskStatus.COMPLETADA):
                    evt(
                        t,
                        HistoryAction.CAMBIO_ESTADO,
                        TaskStatus.EN_PROGRESO,
                        TaskStatus.EN_REVISION,
                        _at(due - datetime.timedelta(days=3)),
                        actor,
                        "Primera entrega para revisión",
                    )
                    evt(
                        t,
                        HistoryAction.CAMBIO_ESTADO,
                        TaskStatus.EN_REVISION,
                        TaskStatus.DEVUELTA,
                        _at(due - datetime.timedelta(days=2)),
                        lead_id,
                        "Devuelta: faltan objetivos de aprendizaje",
                    )
                    evt(
                        t,
                        HistoryAction.CAMBIO_ESTADO,
                        TaskStatus.DEVUELTA,
                        TaskStatus.EN_REVISION,
                        _at(due - datetime.timedelta(days=1)),
                        actor,
                        "Reenvía con correcciones",
                    )
                if t.status == TaskStatus.COMPLETADA:
                    evt(
                        t,
                        HistoryAction.CAMBIO_ESTADO,
                        TaskStatus.EN_REVISION,
                        TaskStatus.COMPLETADA,
                        _at(due),
                        lead_id,
                        "Entrega aprobada",
                    )
                if due < today and t.status not in (
                    TaskStatus.COMPLETADA,
                    TaskStatus.CANCELADA,
                ):
                    evt(
                        t,
                        HistoryAction.CAMBIO_ESTADO,
                        TaskStatus.EN_PROGRESO,
                        TaskStatus.EN_PROGRESO,
                        _at(today, 11),
                        actor,
                        "Sigue en progreso tras la fecha límite",
                    )
                    evt(
                        t,
                        HistoryAction.COMENTARIO,
                        None,
                        None,
                        _at(today, 12),
                        actor,
                        "Reporta retraso por dependencia pendiente",
                    )

            await session.commit()
            logger.info("Historial demo creado", project=DEMO_PROJECT_NAME)
    except Exception as exc:  # noqa: BLE001
        logger.warning("No se pudo sembrar el historial demo", error=str(exc))
