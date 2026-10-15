"""Agregaciones puras de la analítica: salud, avance frente al plan y estado por
componente de la estructura.

Sin base de datos y sin `async`: reciben las tareas y los elementos ya cargados
y devuelven estructuras sencillas. Así se prueban con objetos de juguete y el
`ProjectAnalyticsBuilder` se limita a orquestar consultas.

Vocabulario:
- **salud** de una tarea: completada / cancelada / vencida / en riesgo / al día.
- **iniciada**: una tarea con trabajo declarado (en progreso, en revisión,
  devuelta, o pendiente pero con un avance ya registrado). Es lo que permite
  hablar del «progreso empezado» de un componente y no solo de lo terminado.
- **componente**: cualquier elemento de la estructura (curso, módulo, unidad…);
  sus cifras suman TODO lo que cuelga de él, no solo sus tareas directas.
"""

import datetime
from collections import defaultdict
from dataclasses import dataclass
from enum import Enum
from typing import Iterable, Mapping
from uuid import UUID

from app.modules.tasks.infrastructure.enums import TaskStatus
from app.shared.business_calendar import business_days_between

AT_RISK_HORIZON_BDAYS = 5

# Tolerancia del avance frente al plan (en puntos porcentuales).
_ON_TRACK_GAP_PTS = 5
_WATCH_GAP_PTS = 15

_STARTED_STATUSES = (
    TaskStatus.EN_PROGRESO,
    TaskStatus.EN_REVISION,
    TaskStatus.DEVUELTA,
)


class TaskHealth(str, Enum):
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    OVERDUE = "overdue"
    AT_RISK = "at_risk"
    ON_TRACK = "on_track"


def task_health(task, today: datetime.date) -> TaskHealth:
    """Salud de una tarea a fecha `today`.

    Vencida = abierta con fecha límite pasada; en riesgo = abierta que vence en
    los próximos `AT_RISK_HORIZON_BDAYS` días laborables; el resto, al día
    (incluidas las que no tienen fecha, de las que no se puede decir otra cosa).
    """
    if task.status == TaskStatus.COMPLETADA:
        return TaskHealth.COMPLETED
    if task.status == TaskStatus.CANCELADA:
        return TaskHealth.CANCELLED
    due = task.due_date
    if due is None:
        return TaskHealth.ON_TRACK
    if due < today:
        return TaskHealth.OVERDUE
    if business_days_between(today, due) <= AT_RISK_HORIZON_BDAYS:
        return TaskHealth.AT_RISK
    return TaskHealth.ON_TRACK


def is_started(task, progress_pct: int) -> bool:
    """¿Hay trabajo en marcha? Las completadas y canceladas no cuentan como
    «iniciadas»: ya terminaron (o se descartaron)."""
    if task.status in (TaskStatus.COMPLETADA, TaskStatus.CANCELADA):
        return False
    return task.status in _STARTED_STATUSES or progress_pct > 0


# ── Salud del conjunto ───────────────────────────────────────────────────────


@dataclass
class HealthBreakdown:
    total: int  # sin canceladas: lo que hay que entregar
    completed: int
    on_track: int
    at_risk: int
    overdue: int


def build_health(tasks: Iterable, today: datetime.date) -> HealthBreakdown:
    counts: dict[TaskHealth, int] = defaultdict(int)
    for t in tasks:
        counts[task_health(t, today)] += 1
    completed = counts[TaskHealth.COMPLETED]
    on_track = counts[TaskHealth.ON_TRACK]
    at_risk = counts[TaskHealth.AT_RISK]
    overdue = counts[TaskHealth.OVERDUE]
    return HealthBreakdown(
        total=completed + on_track + at_risk + overdue,
        completed=completed,
        on_track=on_track,
        at_risk=at_risk,
        overdue=overdue,
    )


# ── Avance frente al plan ────────────────────────────────────────────────────


class PlanStatus(str, Enum):
    ON_TRACK = "on_track"
    WATCH = "watch"
    AT_RISK = "at_risk"


@dataclass
class PlanProgress:
    window_start: str
    window_end: str
    today: str
    day_index: int  # días transcurridos desde el inicio (acotado a la ventana)
    total_days: int
    expected_tasks: int  # tareas cuya fecha límite ya pasó o es hoy
    expected_pct: int
    completed_tasks: int
    completed_pct: int
    gap_pts: int  # esperado - real; + = por detrás del plan
    status: PlanStatus


def build_plan_progress(
    tasks: Iterable,
    window_start: datetime.date,
    window_end: datetime.date,
    today: datetime.date,
) -> PlanProgress:
    """Lo que el cronograma esperaba tener cerrado hoy frente a lo realmente
    completado.

    «Esperado» = tareas (sin canceladas) cuya fecha límite es hoy o anterior:
    es lo que, según el propio plan, ya tendría que estar hecho. Las tareas sin
    fecha no se pueden esperar de nadie, así que no suman aquí.
    """
    live = [t for t in tasks if t.status != TaskStatus.CANCELADA]
    total = len(live)
    expected = sum(1 for t in live if t.due_date is not None and t.due_date <= today)
    completed = sum(1 for t in live if t.status == TaskStatus.COMPLETADA)
    expected_pct = round(expected / total * 100) if total else 0
    completed_pct = round(completed / total * 100) if total else 0
    gap = expected_pct - completed_pct

    total_days = max((window_end - window_start).days, 1)
    day_index = min(max((today - window_start).days, 0), total_days)
    return PlanProgress(
        window_start=window_start.isoformat(),
        window_end=window_end.isoformat(),
        today=today.isoformat(),
        day_index=day_index,
        total_days=total_days,
        expected_tasks=expected,
        expected_pct=expected_pct,
        completed_tasks=completed,
        completed_pct=completed_pct,
        gap_pts=gap,
        status=_plan_status(gap),
    )


def _plan_status(gap_pts: int) -> PlanStatus:
    if gap_pts <= _ON_TRACK_GAP_PTS:
        return PlanStatus.ON_TRACK
    if gap_pts <= _WATCH_GAP_PTS:
        return PlanStatus.WATCH
    return PlanStatus.AT_RISK


# ── Estado por componente ────────────────────────────────────────────────────


class ComponentState(str, Enum):
    EMPTY = "sin_tareas"
    NOT_STARTED = "sin_iniciar"
    IN_PROGRESS = "en_curso"
    AT_RISK = "en_riesgo"
    OVERDUE = "atrasada"
    COMPLETED = "completada"


@dataclass
class _Tally:
    """Contadores sumables: el de un componente es el suyo más el de sus hijos."""

    direct: int = 0
    total: int = 0
    completed: int = 0
    started: int = 0
    not_started: int = 0
    overdue: int = 0
    at_risk: int = 0
    progress_sum: int = 0
    started_progress_sum: int = 0

    def add(self, other: "_Tally") -> None:
        for name in self.__dataclass_fields__:
            if name != "direct":
                setattr(self, name, getattr(self, name) + getattr(other, name))


@dataclass
class ComponentStats:
    id: UUID
    parent_id: UUID | None
    name: str
    tipo_id: UUID | None
    tipo_nombre: str | None
    depth: int
    path: list[str]
    child_count: int
    direct_tasks: int
    total: int
    completed: int
    started: int
    not_started: int
    overdue: int
    at_risk: int
    completed_pct: int  # tareas terminadas / tareas
    started_pct: int  # tareas con trabajo en marcha / tareas
    progress_pct: int  # media del avance de TODAS (cuenta lo empezado)
    started_progress_pct: int  # media del avance de las iniciadas
    state: ComponentState


def _pct(part: int, whole: int) -> int:
    return round(part / whole * 100) if whole else 0


def _avg(total: int, count: int) -> int:
    """Media de porcentajes ya sumados (cada sumando va de 0 a 100)."""
    return round(total / count) if count else 0


def component_state(t: _Tally) -> ComponentState:
    if t.total == 0:
        return ComponentState.EMPTY
    if t.completed == t.total:
        return ComponentState.COMPLETED
    if t.overdue > 0:
        return ComponentState.OVERDUE
    if t.at_risk > 0:
        return ComponentState.AT_RISK
    if t.started > 0 or t.completed > 0:
        return ComponentState.IN_PROGRESS
    return ComponentState.NOT_STARTED


def build_component_stats(
    work_items: list,
    tasks: Iterable,
    progress_by_task: Mapping[UUID, int],
    paths: Mapping[UUID | None, list[str]],
    tipo_names: Mapping[UUID, str],
    today: datetime.date,
    only_subtree: set[UUID] | None = None,
) -> list[ComponentStats]:
    """Estadísticas por elemento de la estructura, en orden de árbol (cada padre
    antes que sus hijos, hermanos por `orden`) para poder pintarlas tal cual.

    `only_subtree` recorta a una rama: lo usa el filtro «Estructura». Las tareas
    sin elemento no pertenecen a ningún componente y quedan fuera.
    """
    items = [i for i in work_items if only_subtree is None or i.id in only_subtree]
    ids = {i.id for i in items}

    children: dict[UUID | None, list] = defaultdict(list)
    for it in items:
        parent = it.parent_id if it.parent_id in ids else None
        children[parent].append(it)
    for siblings in children.values():
        siblings.sort(key=lambda i: (i.orden, i.nombre.lower()))

    direct: dict[UUID, _Tally] = defaultdict(_Tally)
    for t in tasks:
        if t.work_item_id is None or t.work_item_id not in ids:
            continue
        health = task_health(t, today)
        if health is TaskHealth.CANCELLED:
            continue
        pct = progress_by_task.get(t.id, 100 if health is TaskHealth.COMPLETED else 0)
        tally = direct[t.work_item_id]
        tally.direct += 1
        tally.total += 1
        tally.progress_sum += pct
        if health is TaskHealth.COMPLETED:
            tally.completed += 1
        elif is_started(t, pct):
            tally.started += 1
            tally.started_progress_sum += pct
        else:
            tally.not_started += 1
        if health is TaskHealth.OVERDUE:
            tally.overdue += 1
        elif health is TaskHealth.AT_RISK:
            tally.at_risk += 1

    out: list[ComponentStats] = []

    def visit(item, depth: int) -> _Tally:
        slot = len(out)
        out.append(None)  # type: ignore[arg-type]  # se rellena al volver del subárbol
        tally = _Tally()
        tally.add(direct.get(item.id, _Tally()))
        kids = children.get(item.id, [])
        for kid in kids:
            tally.add(visit(kid, depth + 1))
        out[slot] = ComponentStats(
            id=item.id,
            parent_id=item.parent_id if item.parent_id in ids else None,
            name=item.nombre,
            tipo_id=item.tipo_id,
            tipo_nombre=tipo_names.get(item.tipo_id),
            depth=depth,
            path=paths.get(item.id, [item.nombre]),
            child_count=len(kids),
            direct_tasks=direct[item.id].direct if item.id in direct else 0,
            total=tally.total,
            completed=tally.completed,
            started=tally.started,
            not_started=tally.not_started,
            overdue=tally.overdue,
            at_risk=tally.at_risk,
            completed_pct=_pct(tally.completed, tally.total),
            started_pct=_pct(tally.started, tally.total),
            progress_pct=_avg(tally.progress_sum, tally.total),
            started_progress_pct=_avg(tally.started_progress_sum, tally.started),
            state=component_state(tally),
        )
        return tally

    for root in children.get(None, []):
        visit(root, 0)
    return out
