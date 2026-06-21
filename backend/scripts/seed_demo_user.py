"""Seed de datos de demostración para el usuario USER `usuario.demo@obj.com`.

Crea (de forma idempotente) 2 proyectos donde el usuario es INTEGRANTE, cada uno
con su estructura mínima (TipoNodo -> WorkItem) y varias tareas en distintos
estados/fechas. Algunas tareas NO están asignadas al usuario, para que el
"progreso general" del proyecto difiera de "sus tareas".

Uso: poetry run python scripts/seed_demo_user.py
"""

import asyncio
import datetime
import uuid

import app.core.models_registry  # noqa: F401  (resuelve relaciones ORM)
from app.core.database import AsyncSessionLocal
from app.modules.identity.infrastructure.models import User
from app.modules.project.infrastructure.enums import ProjectRole
from app.modules.project.infrastructure.models import Project, ProjectMember
from app.modules.project.structure.infrastructure.models import TipoNodo, WorkItem
from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.tasks.infrastructure.models import Task
from sqlalchemy import select

DEMO_EMAIL = "usuario.demo@obj.com"
TODAY = datetime.date.today()
NOW = datetime.datetime.now(datetime.timezone.utc)


def _d(offset_days: int) -> datetime.date:
    return TODAY + datetime.timedelta(days=offset_days)


# (título, estado, offset_due_días, asignar_al_usuario)
PROJECTS = [
    {
        "name": "Virtualización Curso de Excel (Demo)",
        "client_name": "Área de Formación",
        "tipo": "Módulo",
        "work_item": "Módulo 1 — Fundamentos",
        "tasks": [
            ("Guion didáctico del módulo 1", TaskStatus.COMPLETADA, -12, True),
            ("Grabación de videos del módulo 1", TaskStatus.EN_PROGRESO, 3, True),
            (
                "Maquetación SCORM del módulo 2",
                TaskStatus.PENDIENTE_POR_INICIAR,
                10,
                True,
            ),
            ("Revisión de estilo del módulo 1", TaskStatus.EN_REVISION, 1, True),
            ("Correcciones del módulo 1", TaskStatus.DEVUELTA, -2, True),
            ("Carga del curso al LMS", TaskStatus.COMPLETADA, -5, False),
        ],
    },
    {
        "name": "Plataforma LMS Interna (Demo)",
        "client_name": "TI — Producto",
        "tipo": "Componente",
        "work_item": "Componente — Inscripciones",
        "tasks": [
            ("Maqueta UI del login", TaskStatus.COMPLETADA, -8, True),
            ("Integración de la API de cursos", TaskStatus.EN_PROGRESO, 5, True),
            ("Pruebas QA del flujo de inscripción", TaskStatus.EN_REVISION, 2, True),
            ("Bug: el progreso no se guarda", TaskStatus.EN_PROGRESO, -1, True),
            ("Despliegue a staging", TaskStatus.COMPLETADA, -3, False),
        ],
    },
]


async def main() -> None:
    async with AsyncSessionLocal() as session:
        user = (
            await session.execute(select(User).where(User.email == DEMO_EMAIL))
        ).scalar_one_or_none()
        if user is None:
            raise SystemExit(f"No existe el usuario {DEMO_EMAIL}. Créalo primero.")

        # Coordinador opcional: cualquier otro usuario, para que se vea en el panel.
        coordinator = (
            await session.execute(select(User).where(User.email != DEMO_EMAIL).limit(1))
        ).scalar_one_or_none()

        created = 0
        for spec in PROJECTS:
            exists = (
                await session.execute(
                    select(Project).where(Project.name == spec["name"])
                )
            ).scalar_one_or_none()
            if exists is not None:
                print(f"- Ya existe '{spec['name']}', se omite.")
                continue

            total = len(spec["tasks"])
            done = sum(1 for t in spec["tasks"] if t[1] is TaskStatus.COMPLETADA)
            project = Project(
                id=uuid.uuid4(),
                name=spec["name"],
                client_name=spec["client_name"],
                start_date=_d(-30),
                end_date=_d(45),
                progress_pct=round(done / total * 100, 2) if total else 0.0,
            )
            session.add(project)
            await session.flush()

            # El usuario demo como integrante; coordinador opcional.
            session.add(
                ProjectMember(
                    project_id=project.id,
                    user_id=user.id,
                    project_role=ProjectRole.INTEGRANTE,
                )
            )
            if coordinator is not None:
                session.add(
                    ProjectMember(
                        project_id=project.id,
                        user_id=coordinator.id,
                        project_role=ProjectRole.COORDINADOR,
                    )
                )

            tipo = TipoNodo(
                id=uuid.uuid4(), proyecto_id=project.id, nombre=spec["tipo"]
            )
            session.add(tipo)
            await session.flush()
            work_item = WorkItem(
                id=uuid.uuid4(),
                proyecto_id=project.id,
                tipo_id=tipo.id,
                nombre=spec["work_item"],
                orden=0,
            )
            session.add(work_item)
            await session.flush()

            for title, status, due_offset, mine in spec["tasks"]:
                session.add(
                    Task(
                        id=uuid.uuid4(),
                        title=title,
                        status=status,
                        work_item_id=work_item.id,
                        assignee_id=user.id if mine else None,
                        start_date=_d(-20),
                        due_date=_d(due_offset),
                        completed_at=(
                            NOW - datetime.timedelta(days=2)
                            if status is TaskStatus.COMPLETADA
                            else None
                        ),
                    )
                )
            created += 1
            print(f"[OK] Creado '{spec['name']}' con {total} tareas.")

        await session.commit()
        print(f"\nListo. Proyectos nuevos: {created}.")


if __name__ == "__main__":
    asyncio.run(main())
