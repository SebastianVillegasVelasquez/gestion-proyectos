"""Sembrado de carga para probar el flujo del sistema con muchos datos.

Crea de forma consistente:
  * 50 integrantes con roles (SystemRole) y cargos (UserPosition) distribuidos.
  * 5 proyectos. Un equipo VIVE DENTRO DE UN PROYECTO (`teams.project_id`), así
    que cada proyecto crea los suyos a partir de las plantillas de `TEAM_SPECS`;
    el reparto de `PROJECT_TEAMS` cubre las 7 plantillas, de modo que todo
    integrante acaba en al menos un proyecto y en un equipo de ese proyecto.
  * Los integrantes de esos equipos se copian al proyecto (snapshot Opción A,
    con `source_team_id` apuntando al equipo del propio proyecto).
  * Una tarea por cada integrante y una tarea por cada equipo (asignada a su
    líder, con `team_id`), desde hoy. Una buena parte se crea VENCIDA (fecha de
    fin en el pasado) o venciendo HOY para ver esos estados en las vistas.

Las cuentas quedan listas para entrar: se crean con el modelo directamente, así
que `must_change_password` se queda en su default False y no aparece el modal de
primer ingreso (eso solo lo activa el alta por la API, `UserService.create_user`).
Todas comparten la contraseña `PASSWORD` de aquí abajo.

Idempotente: identifica su propia data con marcadores y la borra antes de
recrearla, así puedes ejecutarlo varias veces.

Uso:
    cd backend && poetry run python scripts/seed_load.py
"""

from __future__ import annotations

import asyncio
import datetime
import uuid

from sqlalchemy import delete, select

import app.core.models_registry  # noqa: F401 - registra los mappers ORM
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.modules.identity.infrastructure.enums import SystemRole, UserPosition
from app.modules.identity.infrastructure.models import User
from app.modules.project.infrastructure.enums import ProjectRole
from app.modules.project.infrastructure.models import Project, ProjectMember
from app.modules.project.structure.infrastructure.enums import DuracionUnidad
from app.modules.project.structure.infrastructure.models import TipoNodo, WorkItem
from app.modules.tasks.infrastructure.enums import TaskPriority, TaskStatus
from app.modules.tasks.infrastructure.models import Task
from app.modules.teams.infrastructure.enums import TeamRole
from app.modules.teams.infrastructure.models import Team, TeamMember

# ── Marcadores para reconocer (y poder borrar) la data de carga ───────────────
EMAIL_DOMAIN = "@carga.objdigital.com"
TEAM_TAG = "[carga]"  # va en la descripción del equipo
PROJECT_PREFIX = "[Carga] "
PASSWORD = "Carga1234*"

TODAY = datetime.date.today()
NOW = datetime.datetime.now(datetime.timezone.utc)

FIRST_NAMES = [
    "María",
    "Juan",
    "Ana",
    "Carlos",
    "Laura",
    "Diego",
    "Sofía",
    "Andrés",
    "Valentina",
    "Santiago",
    "Camila",
    "Felipe",
    "Daniela",
    "Mateo",
    "Lucía",
    "Sebastián",
    "Isabella",
    "Nicolás",
    "Gabriela",
    "Samuel",
    "Mariana",
    "Alejandro",
    "Paula",
    "David",
    "Carolina",
]
LAST_NAMES = [
    "Restrepo",
    "Gómez",
    "López",
    "Martínez",
    "Rodríguez",
    "Pérez",
    "Ramírez",
    "Torres",
    "Vargas",
    "Castro",
    "Ríos",
    "Mejía",
    "Cárdenas",
    "Ospina",
    "Quintero",
    "Naranjo",
    "Salazar",
    "Patiño",
    "Acosta",
    "Hoyos",
]


def _name(i: int) -> tuple[str, str]:
    return FIRST_NAMES[i % len(FIRST_NAMES)], LAST_NAMES[(i // 2) % len(LAST_NAMES)]


# Cuántos integrantes por cargo (suman 50). Cada cargo pertenece a UN equipo.
POSITION_COUNTS: list[tuple[UserPosition, int]] = [
    (UserPosition.DESARROLLADOR, 10),
    (UserPosition.ADMINISTRADOR_MOODLE, 4),
    (UserPosition.DISENADOR_INSTRUCCIONAL, 7),
    (UserPosition.EXPERTO_MULTIMEDIA, 5),
    (UserPosition.DISENADOR_GRAFICO, 4),
    (UserPosition.EXPERTO_TEMATICO, 8),
    (UserPosition.CORRECTOR_ESTILO, 5),
    (UserPosition.PROJECT_MANAGER, 4),
    (UserPosition.SIN_CARGO, 3),
]

# Plantillas de equipo: cada una agrupa uno o más cargos. La unión cubre TODOS
# los cargos, así que todo integrante cae en exactamente una plantilla. Como un
# equipo pertenece a un proyecto, cada proyecto instancia las plantillas que le
# toquen en PROJECT_TEAMS.
TEAM_SPECS: list[tuple[str, str, list[UserPosition]]] = [
    (
        "Equipo de Desarrollo",
        "Maquetación y montaje técnico en el LMS.",
        [UserPosition.DESARROLLADOR, UserPosition.ADMINISTRADOR_MOODLE],
    ),
    (
        "Equipo de Diseño Instruccional",
        "Estructura pedagógica de los cursos.",
        [UserPosition.DISENADOR_INSTRUCCIONAL],
    ),
    (
        "Equipo Multimedia",
        "Producción audiovisual y recursos gráficos.",
        [UserPosition.EXPERTO_MULTIMEDIA, UserPosition.DISENADOR_GRAFICO],
    ),
    (
        "Equipo de Contenido",
        "Expertos temáticos que aportan el contenido base.",
        [UserPosition.EXPERTO_TEMATICO],
    ),
    (
        "Equipo de Calidad",
        "Corrección de estilo y control de calidad.",
        [UserPosition.CORRECTOR_ESTILO],
    ),
    (
        "Equipo de Gestión",
        "Coordinación y seguimiento de proyectos.",
        [UserPosition.PROJECT_MANAGER],
    ),
    (
        "Equipo de Soporte",
        "Apoyo transversal a los demás equipos.",
        [UserPosition.SIN_CARGO],
    ),
]

PROJECT_NAMES = [
    "Diplomado en Analítica de Datos",
    "Maestría Virtual en Educación",
    "Curso de Liderazgo Ejecutivo",
    "Programa de Onboarding Corporativo",
    "Especialización en Inteligencia Artificial",
]

# Qué plantillas (por índice en TEAM_SPECS) instancia cada proyecto. La unión
# cubre las 7 -> todo integrante termina en al menos un proyecto.
PROJECT_TEAMS: list[list[int]] = [
    [0, 1, 2],
    [2, 3, 4],
    [4, 5, 6],
    [6, 0, 3],
    [1, 5, 0],
]


async def reset(session) -> None:
    """Borra la data de carga previa en orden seguro respecto a las FKs."""
    user_ids = (
        (
            await session.execute(
                select(User.id).where(User.email.like(f"%{EMAIL_DOMAIN}"))
            )
        )
        .scalars()
        .all()
    )
    project_ids = (
        (
            await session.execute(
                select(Project.id).where(Project.name.like(f"{PROJECT_PREFIX}%"))
            )
        )
        .scalars()
        .all()
    )
    team_ids = (
        (
            await session.execute(
                select(Team.id).where(Team.description.like(f"%{TEAM_TAG}%"))
            )
        )
        .scalars()
        .all()
    )

    if user_ids:
        # Las dependencias/historial de tareas tienen ON DELETE CASCADE.
        await session.execute(delete(Task).where(Task.assignee_id.in_(user_ids)))
    if project_ids:
        # Orden: primero lo que apunta al proyecto, al final el proyecto. El
        # resto caería por ON DELETE CASCADE, pero lo hacemos explícito para no
        # depender del orden que decida SQLAlchemy.
        # Una tarea lleva `project_id` (NOT NULL), así que ya no hace falta
        # buscarlas por el WorkItem del que cuelgan.
        await session.execute(delete(Task).where(Task.project_id.in_(project_ids)))
        # Los equipos del proyecto: sus miembros primero.
        await session.execute(
            delete(TeamMember).where(
                TeamMember.team_id.in_(
                    select(Team.id).where(Team.project_id.in_(project_ids))
                )
            )
        )
        # `project_members.source_team_id` referencia al equipo: hay que soltar
        # a los integrantes del proyecto antes de borrar sus equipos.
        await session.execute(
            delete(ProjectMember).where(ProjectMember.project_id.in_(project_ids))
        )
        await session.execute(delete(Team).where(Team.project_id.in_(project_ids)))
        await session.execute(
            delete(WorkItem).where(WorkItem.proyecto_id.in_(project_ids))
        )
        await session.execute(
            delete(TipoNodo).where(TipoNodo.proyecto_id.in_(project_ids))
        )
        await session.execute(delete(Project).where(Project.id.in_(project_ids)))
    if team_ids:
        # Equipos de una corrida anterior cuyo proyecto ya no está (o que se
        # crearon cuando los equipos eran globales).
        await session.execute(
            delete(TeamMember).where(TeamMember.team_id.in_(team_ids))
        )
        await session.execute(
            delete(ProjectMember).where(ProjectMember.source_team_id.in_(team_ids))
        )
        await session.execute(delete(Team).where(Team.id.in_(team_ids)))
    if user_ids:
        await session.execute(
            delete(ProjectMember).where(ProjectMember.user_id.in_(user_ids))
        )
        await session.execute(
            delete(TeamMember).where(TeamMember.user_id.in_(user_ids))
        )
        await session.execute(delete(User).where(User.id.in_(user_ids)))

    await session.flush()


def _build_users() -> list[User]:
    """50 usuarios con cargo asignado y rol de sistema distribuido."""
    positions: list[UserPosition] = []
    for position, count in POSITION_COUNTS:
        positions.extend([position] * count)
    assert len(positions) == 50, len(positions)

    users: list[User] = []
    for i, position in enumerate(positions):
        first, last = _name(i)
        # Los project managers son administradores del sistema; el resto, usuarios.
        role = (
            SystemRole.ADMIN
            if position == UserPosition.PROJECT_MANAGER
            else SystemRole.USER
        )
        users.append(
            User(
                id=uuid.uuid4(),
                email=f"lt{i + 1:02d}{EMAIL_DOMAIN}",
                password=hash_password(PASSWORD),
                name=first,
                last_name=last,
                role=role,
                # `users.position` ya no es un enum nativo: es la `key` de la
                # tabla mutable `positions` (poblada con estos mismos valores),
                # así que se guarda el string, no el miembro del enum.
                position=position.value,
                is_active=True,
            )
        )
    return users


def _task_dates(idx: int) -> tuple[datetime.date, datetime.date, TaskStatus, bool]:
    """Reparte tareas entre vencidas, venciendo hoy y futuras (con variedad)."""
    bucket = idx % 5
    if bucket in (0, 1):
        # Vencida: empezó hace días y su fecha de fin ya pasó.
        return (
            TODAY - datetime.timedelta(days=12),
            TODAY - datetime.timedelta(days=3),
            TaskStatus.EN_PROGRESO if bucket == 0 else TaskStatus.DEVUELTA,
            False,
        )
    if bucket in (2, 3):
        # Vence HOY.
        return (
            TODAY - datetime.timedelta(days=4),
            TODAY,
            TaskStatus.EN_PROGRESO if bucket == 2 else TaskStatus.EN_REVISION,
            False,
        )
    # Futura, o completada de vez en cuando.
    if idx % 7 == 4:
        return (
            TODAY - datetime.timedelta(days=8),
            TODAY - datetime.timedelta(days=1),
            TaskStatus.COMPLETADA,
            True,
        )
    return (
        TODAY + datetime.timedelta(days=2),
        TODAY + datetime.timedelta(days=9),
        TaskStatus.PENDIENTE_POR_INICIAR,
        False,
    )


PRIORITIES = [
    TaskPriority.URGENTE,
    TaskPriority.ALTA,
    TaskPriority.MEDIA,
    TaskPriority.BAJA,
    TaskPriority.MEDIA,
]


async def seed() -> dict:
    async with AsyncSessionLocal() as session:
        await reset(session)

        # ── 1. Integrantes ────────────────────────────────────────────────────
        users = _build_users()
        session.add_all(users)
        await session.flush()

        by_position: dict[str, list[User]] = {}
        for u in users:
            by_position.setdefault(u.position, []).append(u)

        # ── 2. Miembros de cada plantilla de equipo ───────────────────────────
        # Los equipos ya no son globales: se instancian dentro de cada proyecto
        # (paso 3). Aquí solo se resuelve QUIÉN va en cada plantilla.
        spec_members: list[list[User]] = []
        for _name, _desc, positions in TEAM_SPECS:
            members: list[User] = []
            for position in positions:
                members.extend(by_position.get(position.value, []))
            spec_members.append(members)

        # ── 3. Proyectos, sus equipos y el snapshot de integrantes ────────────
        projects: list[Project] = []
        # Equipos creados, por proyecto: `project_teams[p_idx][t_idx]` es el
        # equipo que ese proyecto instanció de la plantilla `t_idx`.
        project_teams: list[dict[int, Team]] = []
        teams_created = 0
        # Reemplazo semántico de las antiguas fases fijas: cada proyecto tiene
        # un TipoNodo "Fase" y tres WorkItems (Planeación / Producción /
        # Publicación) colgando de él. La lista aquí abajo cumple el mismo rol
        # que la vieja `phases`: fases[0]=Planeación, fases[1]=Producción.
        project_phases: list[list[WorkItem]] = []
        user_projects: dict[uuid.UUID, list[tuple[Project, list[WorkItem]]]] = {}

        for p_idx, pname in enumerate(PROJECT_NAMES):
            project = Project(
                id=uuid.uuid4(),
                name=f"{PROJECT_PREFIX}{pname}",
                description=f"Proyecto de carga para pruebas de volumen. {TEAM_TAG}",
                client_name="Universidad OBJ",
                start_date=TODAY - datetime.timedelta(days=30 + p_idx * 5),
                end_date=TODAY + datetime.timedelta(days=60 + p_idx * 10),
                progress_pct=float((p_idx + 1) * 12),
            )
            session.add(project)
            projects.append(project)
            await session.flush()

            # Catálogo de tipos por proyecto (patrón Composite): en este seed
            # solo necesitamos un tipo "Fase" para replicar la estructura vieja.
            tipo_fase = TipoNodo(id=uuid.uuid4(), proyecto_id=project.id, nombre="Fase")
            session.add(tipo_fase)
            await session.flush()

            def _fase(nombre: str, orden: int, dias: int) -> WorkItem:
                return WorkItem(
                    id=uuid.uuid4(),
                    proyecto_id=project.id,
                    tipo_id=tipo_fase.id,
                    nombre=nombre,
                    orden=orden,
                    duracion_valor=dias,
                    duracion_unidad=DuracionUnidad.DIAS,
                )

            phases = [
                _fase("Planeación", 0, 15),
                _fase("Producción", 1, 30),
                _fase("Publicación", 2, 10),
            ]
            session.add_all(phases)
            project_phases.append(phases)
            await session.flush()

            # Los equipos del proyecto: una instancia por plantilla asignada.
            assigned_team_idxs = PROJECT_TEAMS[p_idx]
            teams_here: dict[int, Team] = {}
            for t_idx in assigned_team_idxs:
                name, desc, _positions = TEAM_SPECS[t_idx]
                team = Team(
                    id=uuid.uuid4(),
                    project_id=project.id,
                    name=name,
                    description=f"{desc} {TEAM_TAG}",
                )
                session.add(team)
                teams_here[t_idx] = team
                teams_created += 1
            await session.flush()

            for t_idx, team in teams_here.items():
                for pos, member in enumerate(spec_members[t_idx]):
                    if pos == 0:
                        team_role = TeamRole.LIDER
                    elif pos == 1:
                        team_role = TeamRole.SUPERVISOR
                    else:
                        team_role = TeamRole.INTEGRANTE
                    session.add(
                        TeamMember(
                            team_id=team.id, user_id=member.id, team_role=team_role
                        )
                    )
            project_teams.append(teams_here)
            await session.flush()

            # Snapshot: copia al proyecto los integrantes de sus equipos.
            roles: dict[uuid.UUID, tuple[ProjectRole, uuid.UUID]] = {}
            for t_idx in assigned_team_idxs:
                team = teams_here[t_idx]
                for member in spec_members[t_idx]:
                    roles.setdefault(member.id, (ProjectRole.INTEGRANTE, team.id))
            # El líder del primer equipo asignado coordina el proyecto.
            first_team_idx = assigned_team_idxs[0]
            coord = spec_members[first_team_idx][0]
            roles[coord.id] = (ProjectRole.COORDINADOR, teams_here[first_team_idx].id)

            for user_id, (member_role, source_team_id) in roles.items():
                session.add(
                    ProjectMember(
                        project_id=project.id,
                        user_id=user_id,
                        project_role=member_role,
                        source_team_id=source_team_id,
                    )
                )
                user_projects.setdefault(user_id, []).append((project, phases))
        await session.flush()

        # ── 4. Tareas: una por integrante y una por equipo ────────────────────
        tasks_created = 0
        overdue = 0
        due_today = 0

        for i, user in enumerate(users):
            belongs = user_projects.get(user.id)
            if not belongs:
                # No debería pasar (todos los equipos están asignados), pero por
                # seguridad: si el integrante no está en ningún proyecto, lo
                # saltamos para no crear una tarea huérfana sin fase.
                continue
            project, phases = belongs[0]
            start, due, status, done = _task_dates(i)
            session.add(
                Task(
                    id=uuid.uuid4(),
                    title=f"Entregable de {user.position.replace('_', ' ')} — {user.name}",
                    description="Tarea generada para pruebas de volumen.",
                    status=status,
                    priority=PRIORITIES[i % len(PRIORITIES)],
                    project_id=project.id,
                    work_item_id=phases[1].id,  # Producción
                    assignee_id=user.id,
                    start_date=start,
                    due_date=due,
                    completed_at=NOW if done else None,
                )
            )
            tasks_created += 1
            if due < TODAY:
                overdue += 1
            elif due == TODAY:
                due_today += 1

        # Una tarea por equipo, asignada a su líder. El equipo ya pertenece a un
        # proyecto, así que la tarea se cuelga de ESE proyecto.
        team_slots: list[tuple[int, Team, Project, list[WorkItem]]] = []
        for p_idx, teams_here in enumerate(project_teams):
            for t_idx, team in teams_here.items():
                team_slots.append((t_idx, team, projects[p_idx], project_phases[p_idx]))

        for slot_idx, (t_idx, team, project, phases) in enumerate(team_slots):
            members = spec_members[t_idx]
            if not members:
                continue
            lider = members[0]
            # Las tareas de equipo vencen HOY (o están vencidas para los primeros).
            if slot_idx % 2 == 0:
                start, due, status = (
                    TODAY - datetime.timedelta(days=6),
                    TODAY - datetime.timedelta(days=1),
                    TaskStatus.EN_PROGRESO,
                )
                overdue += 1
            else:
                start, due, status = (
                    TODAY - datetime.timedelta(days=3),
                    TODAY,
                    TaskStatus.EN_REVISION,
                )
                due_today += 1
            session.add(
                Task(
                    id=uuid.uuid4(),
                    title=f"[{team.name}] Coordinar entregables del equipo",
                    description="Tarea de coordinación del equipo (pruebas de volumen).",
                    status=status,
                    priority=TaskPriority.ALTA,
                    project_id=project.id,
                    work_item_id=phases[0].id,  # Planeación
                    assignee_id=lider.id,
                    team_id=team.id,
                    start_date=start,
                    due_date=due,
                    completed_at=None,
                )
            )
            tasks_created += 1

        await session.commit()

        return {
            "users": len(users),
            "teams": teams_created,
            "projects": len(projects),
            "project_members": sum(len(v) for v in user_projects.values()),
            "tasks": tasks_created,
            "overdue_tasks": overdue,
            "due_today_tasks": due_today,
        }


async def _main() -> None:
    import io
    import sys

    # La consola de Windows (cp1252) no codifica algunos caracteres; forzamos
    # UTF-8. `reconfigure` solo existe en TextIOWrapper (stdout real, no
    # redirigido) y el isinstance se lo demuestra a mypy.
    if isinstance(sys.stdout, io.TextIOWrapper):
        sys.stdout.reconfigure(encoding="utf-8")

    stats = await seed()
    print("[OK] Sembrado de carga completado:")
    for key, value in stats.items():
        print(f"   {key:18}: {value}")


if __name__ == "__main__":
    asyncio.run(_main())
