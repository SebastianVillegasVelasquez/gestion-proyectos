"""Reparto de trabajo sobre el proyecto sembrado: equipos, personas y tareas.

La estructura sola (Facultad > Curso > Módulo > Unidad) no ejercita nada: sin
tareas, sin equipos y sin nadie asignado, el cronograma va vacío, el informe da
ceros y la pantalla de equipos no tiene qué mostrar. Esto la llena para poder
trabajar de verdad sobre ella.

Reproduce las tres formas de reparto que existen en la aplicación, porque cada
una se comporta distinto y conviene tenerlas todas a la vista:

  * Dos equipos, cada uno con su líder y sus integrantes.
  * Una persona SIN equipo, con tareas propias.
  * Tareas delegadas al equipo (sin responsable individual), que es como
    trabaja un líder que todavía no ha repartido.

Idempotente: si el proyecto ya tiene tareas, no vuelve a crear nada.
"""

import datetime
import random
import uuid
from decimal import Decimal

from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.core.logger import get_logger
from app.core.security import hash_password
from app.modules.identity.infrastructure.enums import SystemRole, UserPosition
from app.modules.identity.infrastructure.models import User
from app.modules.project.infrastructure.enums import ProjectRole
from app.modules.project.infrastructure.models import Project, ProjectMember
from app.modules.project.structure.infrastructure.models import WorkItem
from app.modules.tasks.infrastructure.enums import TaskPriority, TaskStatus
from app.modules.tasks.infrastructure.models import Task, TaskTimeEntry
from app.modules.teams.infrastructure.enums import TeamRole
from app.modules.teams.infrastructure.models import Team, TeamMember

from app.core.seed_project_structure import PROJECT_NAME

logger = get_logger(__name__)

PASSWORD = "Seed1234*"

# (email, nombre, apellido, cargo). El orden importa: los dos primeros de cada
# bloque de tres son líder e integrante de su equipo.
_PRODUCCION = [
    ("lider.produccion@seed.obj.com", "Camila", "Restrepo", UserPosition.DESARROLLADOR),
    ("editor.video@seed.obj.com", "Andrés", "Molina", UserPosition.DESARROLLADOR),
    (
        "guionista@seed.obj.com",
        "Valentina",
        "Ruiz",
        UserPosition.DISENADOR_INSTRUCCIONAL,
    ),
]
_CONTENIDOS = [
    (
        "lider.contenidos@seed.obj.com",
        "Mateo",
        "Cárdenas",
        UserPosition.EXPERTO_TEMATICO,
    ),
    ("revisora@seed.obj.com", "Daniela", "Ospina", UserPosition.EXPERTO_TEMATICO),
]
# Trabaja sin equipo: sus tareas son suyas y de nadie más.
_INDEPENDIENTE = (
    "freelance.diseno@seed.obj.com",
    "Sebastián",
    "Toro",
    UserPosition.DISENADOR_INSTRUCCIONAL,
)

# Qué se produce en cada unidad. Es el trabajo real de una virtualización.
# (plantilla de título, días estimados)
_TAREAS_POR_UNIDAD = [
    ("Guion de {unidad}", 3),
    ("Grabación de {unidad}", 4),
    ("Montaje en LMS de {unidad}", 2),
]

# Mezcla de estados para que el tablero y el informe no salgan todos iguales.
_ESTADOS = [
    TaskStatus.COMPLETADA,
    TaskStatus.EN_PROGRESO,
    TaskStatus.EN_REVISION,
    TaskStatus.PENDIENTE_POR_INICIAR,
    TaskStatus.PENDIENTE_POR_INICIAR,
    TaskStatus.DEVUELTA,
]


async def _ensure_user(session, email, name, last_name, position) -> User:
    existing = (
        (await session.execute(select(User).where(User.email == email)))
        .scalars()
        .first()
    )
    if existing:
        return existing
    user = User(
        email=email,
        password=hash_password(PASSWORD),
        name=name,
        last_name=last_name,
        role=SystemRole.USER,
        position=position,
        is_active=True,
    )
    session.add(user)
    await session.flush()
    return user


async def ensure_project_work() -> None:
    settings = get_settings()
    if not settings.IS_DEV:
        return
    try:
        async with AsyncSessionLocal() as session:
            project = (
                (
                    await session.execute(
                        select(Project).where(Project.name == PROJECT_NAME)
                    )
                )
                .scalars()
                .first()
            )
            if project is None:
                logger.info("Sin proyecto sembrado: no hay dónde repartir trabajo")
                return

            ya_hay_tareas = await session.scalar(
                select(func.count())
                .select_from(Task)
                .where(Task.project_id == project.id)
            )
            if ya_hay_tareas:
                logger.info("El proyecto sembrado ya tiene tareas; no se recrean")
                return

            # ── Personas ──
            produccion = [await _ensure_user(session, *u) for u in _PRODUCCION]
            contenidos = [await _ensure_user(session, *u) for u in _CONTENIDOS]
            independiente = await _ensure_user(session, *_INDEPENDIENTE)
            todos = [*produccion, *contenidos, independiente]

            # Todos son integrantes del proyecto; los líderes lo coordinan.
            for person in todos:
                session.add(
                    ProjectMember(
                        id=uuid.uuid4(),
                        project_id=project.id,
                        user_id=person.id,
                        project_role=(
                            ProjectRole.COORDINADOR
                            if person in (produccion[0], contenidos[0])
                            else ProjectRole.INTEGRANTE
                        ),
                    )
                )

            # ── Equipos: cada uno con su líder y sus integrantes ──
            equipos: list[Team] = []
            for nombre, descripcion, miembros in (
                (
                    "Producción audiovisual",
                    "Graba y monta el material de cada unidad.",
                    produccion,
                ),
                (
                    "Contenidos",
                    "Escribe y revisa el material de cada unidad.",
                    contenidos,
                ),
            ):
                team = Team(
                    id=uuid.uuid4(),
                    project_id=project.id,
                    name=nombre,
                    description=descripcion,
                )
                session.add(team)
                await session.flush()
                for index, person in enumerate(miembros):
                    session.add(
                        TeamMember(
                            id=uuid.uuid4(),
                            team_id=team.id,
                            user_id=person.id,
                            # El primero manda: es quien reparte y revisa.
                            team_role=(
                                TeamRole.LIDER if index == 0 else TeamRole.INTEGRANTE
                            ),
                        )
                    )
                equipos.append(team)
            await session.flush()

            # ── Tareas sobre las unidades ──
            unidades = (
                (
                    await session.execute(
                        select(WorkItem)
                        .join(WorkItem.tipo)
                        .where(
                            WorkItem.proyecto_id == project.id,
                            WorkItem.deleted_at.is_(None),
                        )
                        .order_by(WorkItem.orden)
                    )
                )
                .scalars()
                .all()
            )
            unidades = [w for w in unidades if w.nombre.startswith("Unidad")]

            # Semilla fija: dos ejecuciones producen el mismo reparto, así que
            # lo que se ve en pantalla no cambia solo por volver a sembrar.
            rng = random.Random(2026)
            asignables = [*produccion, *contenidos, independiente]
            # (tarea, quien la hace) — la segunda parte sirve para imputarle
            # después el esfuerzo dedicado.
            tareas: list[tuple[Task, User | None]] = []

            for i, unidad in enumerate(unidades[:60]):
                for j, (plantilla, dias_estimados) in enumerate(_TAREAS_POR_UNIDAD):
                    estado = _ESTADOS[(i + j) % len(_ESTADOS)]
                    inicio = unidad.fecha_inicio_plan
                    fin = unidad.fecha_fin_plan

                    # Contador global de tareas: reparte de forma pareja en vez
                    # de por unidad (con 3 tareas por unidad, (i + j) deja fuera
                    # a la primera persona de la rotación).
                    slot = i * len(_TAREAS_POR_UNIDAD) + j

                    # Una de cada siete se delega al EQUIPO, sin responsable
                    # individual: así se ve el caso del líder que aún no repartió.
                    # El 7 es primo con las 6 personas a propósito: si ambos
                    # ciclos midieran lo mismo, siempre le tocaría al equipo en
                    # el turno de la misma persona y esa se quedaría sin nada.
                    al_equipo = slot % 7 == 0
                    responsable = (
                        None if al_equipo else asignables[slot % len(asignables)]
                    )
                    equipo = equipos[j % len(equipos)] if al_equipo else None

                    task = Task(
                        id=uuid.uuid4(),
                        project_id=project.id,
                        work_item_id=unidad.id,
                        title=plantilla.format(unidad=f"{unidad.nombre} ({i + 1:02d})"),
                        description=None,
                        status=estado,
                        priority=rng.choice(list(TaskPriority)),
                        assignee_id=responsable.id if responsable else None,
                        team_id=equipo.id if equipo else None,
                        start_date=inicio,
                        due_date=fin,
                        estimated_days=dias_estimados,
                        completed_at=(
                            datetime.datetime.now(datetime.timezone.utc)
                            if estado == TaskStatus.COMPLETADA
                            else None
                        ),
                    )
                    session.add(task)
                    tareas.append((task, responsable))

            await session.flush()

            # ── Días dedicados en lo que ya está hecho o en marcha ──
            for task, responsable in tareas:
                if (
                    responsable is None
                    or task.status == TaskStatus.PENDIENTE_POR_INICIAR
                ):
                    continue
                dedicados = rng.choice(["0.25", "0.5", "0.75", "1"])
                session.add(
                    TaskTimeEntry(
                        id=uuid.uuid4(),
                        task_id=task.id,
                        user_id=responsable.id,
                        days=Decimal(dedicados),
                        work_date=task.start_date or datetime.date.today(),
                        notes=None,
                    )
                )

            await session.commit()
            logger.info(
                "Trabajo sembrado sobre el proyecto",
                project=PROJECT_NAME,
                equipos=len(equipos),
                personas=len(todos),
                tareas=len(tareas),
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("No se pudo sembrar el trabajo del proyecto", error=str(exc))
