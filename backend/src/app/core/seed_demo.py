"""Datos de demostración para el entorno de desarrollo.

Crea un proyecto completo (fases, estructura, equipo y tareas con dependencias
y fechas variadas, incluyendo una vencida) para ver las vistas con datos reales.
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
from app.modules.project.infrastructure.enums import NodeType, ProjectRole
from app.modules.project.infrastructure.models import (
    Phase,
    Project,
    ProjectMember,
    ProjectNode,
)
from app.modules.tasks.infrastructure.enums import TaskPriority, TaskStatus
from app.modules.tasks.infrastructure.models import Task, TaskDependency

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

            # Equipo
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

            # Proyecto
            project = Project(
                id=uuid.uuid4(),
                name=DEMO_PROJECT_NAME,
                description="Virtualización de un diplomado en 3 fases.",
                client_name="Universidad OBJ",
                start_date=today - datetime.timedelta(days=20),
                end_date=today + datetime.timedelta(days=60),
                progress_pct=35.0,
            )
            session.add(project)
            await session.flush()

            # Miembros (líder + equipo)
            if lead:
                session.add(
                    ProjectMember(
                        project_id=project.id,
                        user_id=lead.id,
                        project_role=ProjectRole.COORDINADOR,
                    )
                )
            roles = [
                ProjectRole.INTEGRANTE,
                ProjectRole.REVISOR,
                ProjectRole.INTEGRANTE,
            ]
            for user, role in zip(users, roles):
                session.add(
                    ProjectMember(
                        project_id=project.id, user_id=user.id, project_role=role
                    )
                )

            # Fases
            phases = [
                Phase(
                    id=uuid.uuid4(),
                    name="Planeación",
                    order_index=0,
                    duration_days=15,
                    project_id=project.id,
                ),
                Phase(
                    id=uuid.uuid4(),
                    name="Producción",
                    order_index=1,
                    duration_days=30,
                    project_id=project.id,
                ),
                Phase(
                    id=uuid.uuid4(),
                    name="Publicación",
                    order_index=2,
                    duration_days=10,
                    project_id=project.id,
                ),
            ]
            session.add_all(phases)
            await session.flush()

            # Estructura (Programa > Curso > Módulos) en la fase de producción
            programa = ProjectNode(
                id=uuid.uuid4(),
                name="Programa principal",
                node_type=NodeType.PROGRAMA,
                project_id=project.id,
                phase_id=phases[1].id,
            )
            session.add(programa)
            await session.flush()
            curso = ProjectNode(
                id=uuid.uuid4(),
                name="Curso de Fundamentos",
                node_type=NodeType.CURSO,
                project_id=project.id,
                phase_id=phases[1].id,
                parent_id=programa.id,
            )
            session.add(curso)
            await session.flush()
            modulos = [
                ProjectNode(
                    id=uuid.uuid4(),
                    name=f"Unidad {i}",
                    node_type=NodeType.MODULO,
                    type_label="Unidad",
                    project_id=project.id,
                    phase_id=phases[1].id,
                    parent_id=curso.id,
                )
                for i in (1, 2, 3)
            ]
            session.add_all(modulos)
            await session.flush()

            # Tareas con fechas variadas (incluida una vencida) y dependencia
            def task(
                title,
                *,
                phase=None,
                node=None,
                assignee=None,
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
                    phase_id=phase,
                    node_id=node,
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
                phase=phases[0].id,
                assignee=users[1].id,
                status=TaskStatus.COMPLETADA,
                start_offset=-18,
                dur=10,
                done=True,
            )
            task(
                "Aprobar plan con el cliente",
                phase=phases[0].id,
                assignee=lead.id if lead else None,
                status=TaskStatus.EN_REVISION,
                start_offset=-6,
                dur=8,
                priority=TaskPriority.ALTA,
            )
            # Vencida: debía terminar hace días y sigue en progreso
            task(
                "Guion de la Unidad 1",
                node=modulos[0].id,
                assignee=users[2].id,
                status=TaskStatus.EN_PROGRESO,
                start_offset=-10,
                dur=4,
                priority=TaskPriority.URGENTE,
            )
            dev_task = task(
                "Maquetar Unidad 1 en LMS",
                node=modulos[0].id,
                assignee=users[0].id,
                status=TaskStatus.PENDIENTE_POR_INICIAR,
                start_offset=2,
                dur=6,
            )
            task(
                "Guion de la Unidad 2",
                node=modulos[1].id,
                assignee=users[2].id,
                status=TaskStatus.PENDIENTE_POR_INICIAR,
                start_offset=5,
                dur=4,
            )
            task(
                "Publicación final",
                phase=phases[2].id,
                assignee=lead.id if lead else None,
                status=TaskStatus.PENDIENTE_POR_INICIAR,
                start_offset=45,
                dur=8,
            )

            await session.flush()
            # Maquetar depende del guion (finish-to-start)
            session.add(TaskDependency(task_id=dev_task.id, depends_on_id=t_plan.id))

            await session.commit()
            logger.info("Datos demo creados", project=DEMO_PROJECT_NAME)
    except Exception as exc:  # noqa: BLE001
        logger.warning("No se pudo sembrar la data demo", error=str(exc))
