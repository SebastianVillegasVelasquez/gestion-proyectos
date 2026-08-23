"""Siembra un proyecto con estructura académica de 4 niveles (idempotente).

Facultad (raíz) -> Curso (x10) -> Módulo (x3 por curso) -> Unidad (x3 por
módulo). Cada nivel es un `TipoNodo` propio del proyecto; el árbol se arma con
`WorkItem.parent_id` (patrón Composite), igual que el resto de proyectos demo.

Fechas: se calculan con el mismo motor de derivación (`date_engine`) que usa
la app (duración + predecesor/padre -> inicio/fin). Los primeros
`CURSOS_EN_CASCADA` cursos se entregan en cascada (cada uno depende del cierre
del anterior, dependencia Finish-to-Start real vía `WorkItemDependency`); el
resto arranca en paralelo desde el inicio de la facultad.
"""

import datetime
import uuid

from sqlalchemy import select

from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.core.logger import get_logger
from app.modules.project.infrastructure.models import Project
from app.modules.project.structure.domain.date_engine import derive_dates
from app.modules.project.structure.infrastructure.enums import DuracionUnidad
from app.modules.project.structure.infrastructure.models import (
    TipoNodo,
    WorkItem,
    WorkItemDependency,
)

logger = get_logger(__name__)

PROJECT_NAME = "Facultad de Educación Virtual (Seed)"
N_CURSOS = 10
N_MODULOS_POR_CURSO = 3
N_UNIDADES_POR_MODULO = 3
CURSOS_EN_CASCADA = 5  # los primeros N cursos se entregan uno tras otro

UNIDAD_SEMANAS = 1
MODULO_SEMANAS = UNIDAD_SEMANAS * N_UNIDADES_POR_MODULO
CURSO_SEMANAS = MODULO_SEMANAS * N_MODULOS_POR_CURSO


async def ensure_project_structure() -> None:
    settings = get_settings()
    if not settings.IS_DEV:
        return
    try:
        async with AsyncSessionLocal() as session:
            exists = (
                await session.execute(
                    select(Project.id).where(Project.name == PROJECT_NAME)
                )
            ).first()
            if exists:
                logger.info("Proyecto de estructura académica ya sembrado")
                return

            today = datetime.date.today()
            project = Project(
                id=uuid.uuid4(),
                name=PROJECT_NAME,
                description=(
                    "Proyecto sembrado con jerarquía Facultad > Curso > Módulo > Unidad."
                ),
                client_name="Universidad OBJ",
                start_date=today,
                progress_pct=0.0,
            )
            session.add(project)
            await session.flush()

            tipos = {
                nombre: TipoNodo(id=uuid.uuid4(), proyecto_id=project.id, nombre=nombre)
                for nombre in ("Facultad", "Curso", "Módulo", "Unidad")
            }
            session.add_all(tipos.values())
            await session.flush()

            def work_item(
                nombre: str,
                tipo: str,
                orden: int,
                parent: WorkItem | None,
                *,
                inicio: datetime.date | None = None,
                predecessor_end: datetime.date | None = None,
                duracion_valor: int | None = None,
                duracion_unidad: DuracionUnidad | None = None,
            ) -> WorkItem:
                derived = derive_dates(
                    fecha_inicio_plan=inicio,
                    fecha_fin_plan=None,
                    duracion_valor=duracion_valor,
                    duracion_unidad=duracion_unidad,
                    predecessor_end=predecessor_end,
                    parent_start=parent.fecha_inicio_plan if parent else None,
                )
                item = WorkItem(
                    id=uuid.uuid4(),
                    proyecto_id=project.id,
                    parent_id=parent.id if parent else None,
                    tipo_id=tipos[tipo].id,
                    nombre=nombre,
                    orden=orden,
                    fecha_inicio_plan=derived.fecha_inicio_plan,
                    fecha_fin_plan=derived.fecha_fin_plan,
                    duracion_valor=duracion_valor,
                    duracion_unidad=duracion_unidad,
                )
                session.add(item)
                return item

            # La facultad es la raíz: su duración es un rollup (se completa
            # abajo con el cierre del último curso), no un valor propio.
            facultad = work_item(
                "Facultad de Educación Virtual", "Facultad", 0, None, inicio=today
            )
            await session.flush()

            dependencias: list[WorkItemDependency] = []
            cursos: list[WorkItem] = []
            cascada_predecesor: WorkItem | None = None

            for c in range(N_CURSOS):
                en_cascada = c < CURSOS_EN_CASCADA
                if en_cascada and cascada_predecesor is not None:
                    curso = work_item(
                        f"Curso {c + 1:02d}",
                        "Curso",
                        c,
                        facultad,
                        predecessor_end=cascada_predecesor.fecha_fin_plan,
                        duracion_valor=CURSO_SEMANAS,
                        duracion_unidad=DuracionUnidad.SEMANAS,
                    )
                    dependencias.append(
                        WorkItemDependency(
                            work_item_id=curso.id, depends_on_id=cascada_predecesor.id
                        )
                    )
                else:
                    # Primer curso en cascada, o cursos que arrancan en
                    # paralelo desde el inicio de la facultad.
                    curso = work_item(
                        f"Curso {c + 1:02d}",
                        "Curso",
                        c,
                        facultad,
                        inicio=today,
                        duracion_valor=CURSO_SEMANAS,
                        duracion_unidad=DuracionUnidad.SEMANAS,
                    )
                if en_cascada:
                    cascada_predecesor = curso
                cursos.append(curso)
                await session.flush()

                modulo_predecesor: WorkItem | None = None
                for m in range(N_MODULOS_POR_CURSO):
                    if modulo_predecesor is None:
                        modulo = work_item(
                            f"Módulo {m + 1}",
                            "Módulo",
                            m,
                            curso,
                            inicio=curso.fecha_inicio_plan,
                            duracion_valor=MODULO_SEMANAS,
                            duracion_unidad=DuracionUnidad.SEMANAS,
                        )
                    else:
                        modulo = work_item(
                            f"Módulo {m + 1}",
                            "Módulo",
                            m,
                            curso,
                            predecessor_end=modulo_predecesor.fecha_fin_plan,
                            duracion_valor=MODULO_SEMANAS,
                            duracion_unidad=DuracionUnidad.SEMANAS,
                        )
                    modulo_predecesor = modulo
                    await session.flush()

                    unidad_predecesora: WorkItem | None = None
                    for u in range(N_UNIDADES_POR_MODULO):
                        if unidad_predecesora is None:
                            unidad = work_item(
                                f"Unidad {u + 1}",
                                "Unidad",
                                u,
                                modulo,
                                inicio=modulo.fecha_inicio_plan,
                                duracion_valor=UNIDAD_SEMANAS,
                                duracion_unidad=DuracionUnidad.SEMANAS,
                            )
                        else:
                            unidad = work_item(
                                f"Unidad {u + 1}",
                                "Unidad",
                                u,
                                modulo,
                                predecessor_end=unidad_predecesora.fecha_fin_plan,
                                duracion_valor=UNIDAD_SEMANAS,
                                duracion_unidad=DuracionUnidad.SEMANAS,
                            )
                        unidad_predecesora = unidad
                    await session.flush()

            # Rollup: la facultad cierra cuando cierra el último curso.
            fines_curso = [
                c.fecha_fin_plan for c in cursos if c.fecha_fin_plan is not None
            ]
            facultad.fecha_fin_plan = max(fines_curso) if fines_curso else None
            project.end_date = facultad.fecha_fin_plan
            session.add_all(dependencias)

            await session.commit()
            logger.info(
                "Estructura académica sembrada",
                project=PROJECT_NAME,
                cursos_en_cascada=CURSOS_EN_CASCADA,
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("No se pudo sembrar la estructura académica", error=str(exc))
