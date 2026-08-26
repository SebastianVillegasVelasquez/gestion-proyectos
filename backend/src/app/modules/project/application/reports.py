"""Informe de estado de un proyecto: lo que se enseña fuera del sistema.

Dos salidas del mismo dato: un resumen en JSON para verlo en pantalla y un CSV
para llevárselo a una hoja de cálculo, que es lo que acaba pasando cuando hay
que mandarle algo a un cliente o a dirección.

La consulta va directa a la base de datos (no reutiliza los casos de uso de
tareas) porque un informe necesita en UNA pasada lo que aquellos devuelven por
partes —tarea, elemento, responsable, equipo y horas—; encadenarlos sería una
consulta por fila.
"""

import csv
import io
from dataclasses import dataclass, field
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.infrastructure.models import User
from app.modules.project.infrastructure.models import Project
from app.modules.project.structure.infrastructure.models import WorkItem
from app.modules.tasks.infrastructure.models import Task, TaskTimeEntry
from app.modules.teams.infrastructure.models import Team
from app.shared.exceptions import NotFoundError


@dataclass
class ReportRow:
    """Una fila del informe: una tarea con su contexto ya resuelto."""

    elemento: str | None
    tarea: str
    responsable: str | None
    equipo: str | None
    estado: str
    prioridad: str
    inicio: str | None
    fin: str | None
    horas_estimadas: Decimal | None
    horas_dedicadas: Decimal


@dataclass
class PersonEffort:
    nombre: str
    horas: Decimal


@dataclass
class ProjectReport:
    project_id: UUID
    project_name: str
    total_tareas: int
    tareas_por_estado: dict[str, int] = field(default_factory=dict)
    horas_estimadas: Decimal = Decimal("0")
    horas_dedicadas: Decimal = Decimal("0")
    horas_por_persona: list[PersonEffort] = field(default_factory=list)
    filas: list[ReportRow] = field(default_factory=list)


class ProjectReportBuilder:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def build(self, project_id: UUID) -> ProjectReport:
        project = await self._session.get(Project, project_id)
        if project is None or project.deleted_at is not None:
            raise NotFoundError("El proyecto no existe")

        rows = await self._task_rows(project_id)
        by_status: dict[str, int] = {}
        estimated = Decimal("0")
        logged = Decimal("0")
        for row in rows:
            by_status[row.estado] = by_status.get(row.estado, 0) + 1
            estimated += row.horas_estimadas or Decimal("0")
            logged += row.horas_dedicadas

        return ProjectReport(
            project_id=project_id,
            project_name=project.name,
            total_tareas=len(rows),
            tareas_por_estado=by_status,
            horas_estimadas=estimated,
            horas_dedicadas=logged,
            horas_por_persona=await self._effort_by_person(project_id),
            filas=rows,
        )

    async def _task_rows(self, project_id: UUID) -> list[ReportRow]:
        # Horas dedicadas por tarea en una sola agregación; unirla como
        # subconsulta evita pedir el total tarea a tarea.
        logged = (
            select(
                TaskTimeEntry.task_id.label("task_id"),
                func.sum(TaskTimeEntry.hours).label("total"),
            )
            .group_by(TaskTimeEntry.task_id)
            .subquery()
        )
        query = (
            select(
                Task,
                WorkItem.nombre,
                User.name,
                User.last_name,
                Team.name,
                logged.c.total,
            )
            .select_from(Task)
            .outerjoin(WorkItem, Task.work_item_id == WorkItem.id)
            .outerjoin(User, Task.assignee_id == User.id)
            .outerjoin(Team, Task.team_id == Team.id)
            .outerjoin(logged, logged.c.task_id == Task.id)
            .where(Task.project_id == project_id, Task.deleted_at.is_(None))
            .order_by(WorkItem.orden, Task.start_date, Task.title)
        )
        rows = (await self._session.execute(query)).all()
        return [
            ReportRow(
                elemento=element_name,
                tarea=task.title,
                responsable=(
                    f"{first_name} {last_name}".strip() if first_name else None
                ),
                equipo=team_name,
                estado=getattr(task.status, "value", str(task.status)),
                prioridad=getattr(task.priority, "value", str(task.priority)),
                inicio=task.start_date.isoformat() if task.start_date else None,
                fin=task.due_date.isoformat() if task.due_date else None,
                horas_estimadas=task.estimated_hours,
                horas_dedicadas=Decimal(total or 0),
            )
            for task, element_name, first_name, last_name, team_name, total in rows
        ]

    async def _effort_by_person(self, project_id: UUID) -> list[PersonEffort]:
        """Horas dedicadas por persona: la base para pagar o para repartir mejor.

        Se agrupa por QUIEN APUNTÓ las horas, no por el responsable de la tarea:
        en una tarea puede haber trabajado más de una persona.
        """
        query = (
            select(User.name, User.last_name, func.sum(TaskTimeEntry.hours))
            .select_from(TaskTimeEntry)
            .join(Task, TaskTimeEntry.task_id == Task.id)
            .join(User, TaskTimeEntry.user_id == User.id)
            .where(Task.project_id == project_id, Task.deleted_at.is_(None))
            .group_by(User.name, User.last_name)
            .order_by(func.sum(TaskTimeEntry.hours).desc())
        )
        rows = (await self._session.execute(query)).all()
        return [
            PersonEffort(
                nombre=f"{name} {last_name}".strip(), horas=Decimal(total or 0)
            )
            for name, last_name, total in rows
        ]


CSV_HEADERS = [
    "Elemento",
    "Tarea",
    "Responsable",
    "Equipo",
    "Estado",
    "Prioridad",
    "Inicio",
    "Fin",
    "Horas estimadas",
    "Horas dedicadas",
]


def report_to_csv(report: ProjectReport) -> str:
    """Serializa el informe a CSV para abrirlo en Excel o Google Sheets.

    Separador `;` y BOM UTF-8: es lo que hace que Excel en español abra el
    archivo con las columnas separadas y con las tildes bien, en vez de
    volcarlo todo en la primera columna.
    """
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";", lineterminator="\r\n")
    writer.writerow(CSV_HEADERS)
    for row in report.filas:
        writer.writerow(
            [
                row.elemento or "",
                row.tarea,
                row.responsable or "",
                row.equipo or "",
                row.estado,
                row.prioridad,
                row.inicio or "",
                row.fin or "",
                _decimal(row.horas_estimadas),
                _decimal(row.horas_dedicadas),
            ]
        )
    return "﻿" + buffer.getvalue()


def _decimal(value: Decimal | None) -> str:
    """Coma decimal: en es-CO "2,5" es lo que Excel interpreta como número."""
    if value is None:
        return ""
    return f"{value:.2f}".replace(".", ",")
