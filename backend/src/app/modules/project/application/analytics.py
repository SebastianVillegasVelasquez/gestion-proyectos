"""Analítica del proyecto para el informe interactivo (fase 6.1).

El informe que se enseña a dirección: rendimiento del proyecto en el tiempo,
por equipo, por persona y por lapsos de entrega. Todas las duraciones se miden
en DÍAS LABORABLES (lun-vie), nunca en horas — corrección explícita de negocio.

Una sola pasada por la base de datos: tareas, su historial de estados
(`task_history`), la estructura (para las rutas) y las versiones de entregable.
Todo el cálculo ocurre en memoria porque un proyecto está acotado (cientos de
tareas, algunos miles de eventos).
"""

import datetime
from collections import defaultdict
from dataclasses import dataclass, field
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.infrastructure.models import User
from app.modules.project.infrastructure.models import Project
from app.modules.project.structure.infrastructure.models import WorkItem
from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.tasks.infrastructure.models import Task, TaskHistory, TaskTimeEntry
from app.modules.teams.infrastructure.models import Team, TeamMember
from app.modules.teams.infrastructure.workspace_models import (
    Deliverable,
    DeliverableVersion,
)
from app.shared.business_calendar import business_days_between, business_days_span
from app.shared.exceptions import NotFoundError

_OPEN = (
    TaskStatus.PENDIENTE_POR_INICIAR,
    TaskStatus.EN_PROGRESO,
    TaskStatus.EN_REVISION,
    TaskStatus.DEVUELTA,
)
_AT_RISK_HORIZON_BDAYS = 5


# ── Estructuras de salida ────────────────────────────────────────────────────


@dataclass
class SeriesPoint:
    date: str  # YYYY-MM-DD
    ideal: float
    actual: int


@dataclass
class WeekCount:
    week_start: str  # lunes de la semana ISO, YYYY-MM-DD
    count: int


@dataclass
class Overview:
    total_tasks: int
    by_status: dict[str, int]
    progress_pct: int
    overdue_open: int
    at_risk_open: int
    avg_schedule_slip_bdays: float  # media de días laborables de desviación (+ = tarde)
    cycle_time_p50_bdays: float
    cycle_time_p90_bdays: float
    rework_rate_pct: float
    throughput_last_weeks: list[WeekCount] = field(default_factory=list)


@dataclass
class Burnup:
    window_start: str
    window_end: str
    total_scope: int
    points: list[SeriesPoint] = field(default_factory=list)


@dataclass
class MemberLoad:
    user_id: UUID
    name: str
    open_count: int


@dataclass
class TeamPerformance:
    team_id: UUID
    team_name: str
    assigned: int
    completed: int
    open: int
    overdue: int
    cycle_time_bdays: float
    review_time_bdays: float
    rework_rate_pct: float
    open_per_member: list[MemberLoad] = field(default_factory=list)


@dataclass
class PersonPerformance:
    user_id: UUID
    name: str
    completed: int
    open_count: int
    cycle_time_bdays: float
    on_time_pct: float
    returns_received: int
    logged_days: float


@dataclass
class DeliveryLapse:
    task_id: UUID
    task_title: str
    element_path: list[str]
    versions: int
    production_bdays: int
    review_bdays: int
    total_bdays: int


@dataclass
class TaskRow:
    task_id: UUID
    title: str
    element_path: list[str]
    responsable: str | None
    equipo: str | None
    estado: str
    prioridad: str
    start_date: str | None
    due_date: str | None
    completed_date: str | None
    slip_bdays: int | None  # + = cerró tarde; None si no aplica
    returns: int
    versions: int


@dataclass
class ProjectAnalytics:
    project_id: UUID
    project_name: str
    generated_at: str
    filters: dict[str, str | None]
    overview: Overview
    burnup: Burnup
    by_team: list[TeamPerformance] = field(default_factory=list)
    by_person: list[PersonPerformance] = field(default_factory=list)
    delivery_lapses: list[DeliveryLapse] = field(default_factory=list)
    tasks: list[TaskRow] = field(default_factory=list)


# ── Utilidades de agregación ─────────────────────────────────────────────────


def _mean(values: list[int]) -> float:
    return round(sum(values) / len(values), 1) if values else 0.0


def _percentile(values: list[int], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    k = (len(ordered) - 1) * pct
    lo = int(k)
    hi = min(lo + 1, len(ordered) - 1)
    return round(ordered[lo] + (ordered[hi] - ordered[lo]) * (k - lo), 1)


def _monday(d: datetime.date) -> datetime.date:
    return d - datetime.timedelta(days=d.weekday())


# ── Builder ──────────────────────────────────────────────────────────────────


@dataclass
class AnalyticsFilters:
    date_from: datetime.date | None = None
    date_to: datetime.date | None = None
    team_id: UUID | None = None
    assignee_id: UUID | None = None
    status: TaskStatus | None = None
    priority: str | None = None
    work_item_id: UUID | None = None


class ProjectAnalyticsBuilder:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def build(
        self, project_id: UUID, filters: AnalyticsFilters | None = None
    ) -> ProjectAnalytics:
        f = filters or AnalyticsFilters()
        project = await self._session.get(Project, project_id)
        if project is None or project.deleted_at is not None:
            raise NotFoundError("El proyecto no existe")

        work_items = await self._work_items(project_id)
        path_by_item = _build_paths(work_items)
        subtree = _subtree_ids(work_items, f.work_item_id) if f.work_item_id else None

        tasks = await self._tasks(project_id)
        tasks = [t for t in tasks if _passes(t, f, subtree)]
        task_ids = [t.id for t in tasks]

        history = await self._history(task_ids)
        versions_by_task = await self._version_counts(task_ids)
        days_by_user = await self._days_by_user(project_id)
        teams = await self._teams(project_id)
        members_by_team = await self._members_by_team([t.id for t in teams])
        user_names = await self._user_names(
            {t.assignee_id for t in tasks if t.assignee_id}
            | {m.user_id for members in members_by_team.values() for m in members}
        )

        # ── Índices por tarea derivados del historial ──
        first_at: dict[UUID, dict[TaskStatus, datetime.date]] = defaultdict(dict)
        returns_by_task: dict[UUID, int] = defaultdict(int)
        for h in history:
            if h.new_status is None:
                continue
            day = h.created_at.date()
            bucket = first_at[h.task_id]
            if h.new_status not in bucket or day < bucket[h.new_status]:
                bucket[h.new_status] = day
            if h.new_status == TaskStatus.DEVUELTA:
                returns_by_task[h.task_id] += 1

        today = datetime.date.today()

        def completion_date(t: Task) -> datetime.date | None:
            hist = first_at.get(t.id, {}).get(TaskStatus.COMPLETADA)
            if hist is not None:
                return hist
            if t.status == TaskStatus.COMPLETADA and t.completed_at is not None:
                return t.completed_at.date()
            return None

        def cycle_bdays(t: Task) -> int | None:
            start = first_at.get(t.id, {}).get(TaskStatus.EN_PROGRESO) or t.start_date
            done = completion_date(t)
            if start is None or done is None:
                return None
            return business_days_span(start, done)

        def production_bdays(t: Task) -> int | None:
            a = first_at.get(t.id, {}).get(TaskStatus.EN_PROGRESO) or t.start_date
            b = first_at.get(t.id, {}).get(TaskStatus.EN_REVISION)
            return business_days_span(a, b) if a and b else None

        def review_bdays(t: Task) -> int | None:
            a = first_at.get(t.id, {}).get(TaskStatus.EN_REVISION)
            b = completion_date(t)
            return business_days_span(a, b) if a and b else None

        # ── Overview ──
        by_status: dict[str, int] = defaultdict(int)
        for t in tasks:
            by_status[t.status.value] += 1
        completed_tasks = [t for t in tasks if t.status == TaskStatus.COMPLETADA]
        not_cancelled = [t for t in tasks if t.status != TaskStatus.CANCELADA]
        progress = (
            round(len(completed_tasks) / len(not_cancelled) * 100)
            if not_cancelled
            else 0
        )
        overdue_open = sum(
            1
            for t in tasks
            if t.status in _OPEN and t.due_date is not None and t.due_date < today
        )
        at_risk_open = sum(
            1
            for t in tasks
            if t.status in _OPEN
            and t.due_date is not None
            and today <= t.due_date
            and business_days_between(today, t.due_date) <= _AT_RISK_HORIZON_BDAYS
        )
        slips = [
            business_days_between(t.due_date, cd)  # + = tarde
            for t in completed_tasks
            if t.due_date is not None and (cd := completion_date(t)) is not None
        ]
        cycles = [c for t in tasks if (c := cycle_bdays(t)) is not None]
        reworked = sum(1 for tid in task_ids if returns_by_task.get(tid, 0) > 0)
        rework_rate = round(reworked / len(task_ids) * 100, 1) if task_ids else 0.0

        overview = Overview(
            total_tasks=len(tasks),
            by_status=dict(by_status),
            progress_pct=progress,
            overdue_open=overdue_open,
            at_risk_open=at_risk_open,
            avg_schedule_slip_bdays=_mean(slips),
            cycle_time_p50_bdays=_percentile(cycles, 0.5),
            cycle_time_p90_bdays=_percentile(cycles, 0.9),
            rework_rate_pct=rework_rate,
            throughput_last_weeks=_throughput(
                [d for t in tasks if (d := completion_date(t)) is not None], today
            ),
        )

        # ── Burn-up ──
        burnup = _burnup(
            tasks,
            completion_date,
            project.start_date,
            project.end_date,
            f.date_from,
            f.date_to,
            today,
        )

        # ── Por equipo ──
        by_team: list[TeamPerformance] = []
        for team in sorted(teams, key=lambda t: t.name.lower()):
            team_tasks = [t for t in tasks if t.team_id == team.id]
            if not team_tasks:
                continue
            t_completed = [t for t in team_tasks if t.status == TaskStatus.COMPLETADA]
            t_open = [t for t in team_tasks if t.status in _OPEN]
            t_reworked = sum(1 for t in team_tasks if returns_by_task.get(t.id, 0) > 0)
            load: dict[UUID, int] = defaultdict(int)
            for t in t_open:
                if t.assignee_id is not None:
                    load[t.assignee_id] += 1
            by_team.append(
                TeamPerformance(
                    team_id=team.id,
                    team_name=team.name,
                    assigned=len(team_tasks),
                    completed=len(t_completed),
                    open=len(t_open),
                    overdue=sum(
                        1
                        for t in t_open
                        if t.due_date is not None and t.due_date < today
                    ),
                    cycle_time_bdays=_mean(
                        [c for t in team_tasks if (c := cycle_bdays(t)) is not None]
                    ),
                    review_time_bdays=_mean(
                        [r for t in team_tasks if (r := review_bdays(t)) is not None]
                    ),
                    rework_rate_pct=(
                        round(t_reworked / len(team_tasks) * 100, 1)
                        if team_tasks
                        else 0.0
                    ),
                    open_per_member=[
                        MemberLoad(
                            user_id=uid,
                            name=user_names.get(uid, "—"),
                            open_count=count,
                        )
                        for uid, count in sorted(
                            load.items(), key=lambda kv: kv[1], reverse=True
                        )
                    ],
                )
            )

        # ── Por persona ──
        by_person: list[PersonPerformance] = []
        assignees = {t.assignee_id for t in tasks if t.assignee_id is not None}
        for uid in assignees:
            mine = [t for t in tasks if t.assignee_id == uid]
            m_completed = [t for t in mine if t.status == TaskStatus.COMPLETADA]
            on_time = sum(
                1
                for t in m_completed
                if t.due_date is not None
                and (cd := completion_date(t)) is not None
                and cd <= t.due_date
            )
            rated = sum(
                1
                for t in m_completed
                if t.due_date is not None and completion_date(t) is not None
            )
            by_person.append(
                PersonPerformance(
                    user_id=uid,
                    name=user_names.get(uid, "—"),
                    completed=len(m_completed),
                    open_count=sum(1 for t in mine if t.status in _OPEN),
                    cycle_time_bdays=_mean(
                        [c for t in mine if (c := cycle_bdays(t)) is not None]
                    ),
                    on_time_pct=round(on_time / rated * 100, 1) if rated else 0.0,
                    returns_received=sum(returns_by_task.get(t.id, 0) for t in mine),
                    logged_days=float(days_by_user.get(uid, Decimal("0"))),
                )
            )
        by_person.sort(key=lambda p: p.completed, reverse=True)

        # ── Lapsos de entrega ──
        lapses: list[DeliveryLapse] = []
        for t in tasks:
            prod = production_bdays(t)
            rev = review_bdays(t)
            vers = versions_by_task.get(t.id, 0)
            if prod is None and rev is None and vers == 0:
                continue
            lapses.append(
                DeliveryLapse(
                    task_id=t.id,
                    task_title=t.title,
                    element_path=path_by_item.get(t.work_item_id, []),
                    versions=vers,
                    production_bdays=prod or 0,
                    review_bdays=rev or 0,
                    total_bdays=(prod or 0) + (rev or 0),
                )
            )
        lapses.sort(key=lambda x: x.total_bdays, reverse=True)

        # ── Tabla de tareas ──
        team_name_by_id = {tm.id: tm.name for tm in teams}
        rows: list[TaskRow] = []
        for t in tasks:
            cd = completion_date(t)
            slip = (
                business_days_between(t.due_date, cd)
                if t.due_date is not None and cd is not None
                else None
            )
            rows.append(
                TaskRow(
                    task_id=t.id,
                    title=t.title,
                    element_path=path_by_item.get(t.work_item_id, []),
                    responsable=user_names.get(t.assignee_id)
                    if t.assignee_id
                    else None,
                    equipo=team_name_by_id.get(t.team_id) if t.team_id else None,
                    estado=t.status.value,
                    prioridad=t.priority.value,
                    start_date=t.start_date.isoformat() if t.start_date else None,
                    due_date=t.due_date.isoformat() if t.due_date else None,
                    completed_date=cd.isoformat() if cd else None,
                    slip_bdays=slip,
                    returns=returns_by_task.get(t.id, 0),
                    versions=versions_by_task.get(t.id, 0),
                )
            )
        rows.sort(key=lambda r: (r.element_path, r.title))

        return ProjectAnalytics(
            project_id=project_id,
            project_name=project.name,
            generated_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            filters={
                "date_from": f.date_from.isoformat() if f.date_from else None,
                "date_to": f.date_to.isoformat() if f.date_to else None,
                "team_id": str(f.team_id) if f.team_id else None,
                "assignee_id": str(f.assignee_id) if f.assignee_id else None,
                "status": f.status.value if f.status else None,
                "priority": f.priority,
                "work_item_id": str(f.work_item_id) if f.work_item_id else None,
            },
            overview=overview,
            burnup=burnup,
            by_team=by_team,
            by_person=by_person,
            delivery_lapses=lapses,
            tasks=rows,
        )

    # ── Consultas ──────────────────────────────────────────────────────────────

    async def _work_items(self, project_id: UUID) -> list[WorkItem]:
        return list(
            (
                await self._session.execute(
                    select(WorkItem).where(
                        WorkItem.proyecto_id == project_id,
                        WorkItem.deleted_at.is_(None),
                    )
                )
            )
            .scalars()
            .all()
        )

    async def _tasks(self, project_id: UUID) -> list[Task]:
        return list(
            (
                await self._session.execute(
                    select(Task).where(
                        Task.project_id == project_id, Task.deleted_at.is_(None)
                    )
                )
            )
            .scalars()
            .all()
        )

    async def _history(self, task_ids: list[UUID]) -> list[TaskHistory]:
        if not task_ids:
            return []
        return list(
            (
                await self._session.execute(
                    select(TaskHistory)
                    .where(TaskHistory.task_id.in_(task_ids))
                    .order_by(TaskHistory.created_at.asc())
                )
            )
            .scalars()
            .all()
        )

    async def _version_counts(self, task_ids: list[UUID]) -> dict[UUID, int]:
        if not task_ids:
            return {}
        rows = (
            await self._session.execute(
                select(Deliverable.task_id, func.count(DeliverableVersion.id))
                .join(
                    DeliverableVersion,
                    DeliverableVersion.deliverable_id == Deliverable.id,
                )
                .where(
                    Deliverable.task_id.in_(task_ids),
                    Deliverable.deleted_at.is_(None),
                )
                .group_by(Deliverable.task_id)
            )
        ).all()
        return {tid: int(count) for tid, count in rows}

    async def _days_by_user(self, project_id: UUID) -> dict[UUID, Decimal]:
        rows = (
            await self._session.execute(
                select(TaskTimeEntry.user_id, func.sum(TaskTimeEntry.days))
                .join(Task, TaskTimeEntry.task_id == Task.id)
                .where(Task.project_id == project_id, Task.deleted_at.is_(None))
                .group_by(TaskTimeEntry.user_id)
            )
        ).all()
        return {uid: Decimal(total or 0) for uid, total in rows}

    async def _teams(self, project_id: UUID) -> list[Team]:
        return list(
            (
                await self._session.execute(
                    select(Team).where(
                        Team.project_id == project_id, Team.deleted_at.is_(None)
                    )
                )
            )
            .scalars()
            .all()
        )

    async def _members_by_team(
        self, team_ids: list[UUID]
    ) -> dict[UUID, list[TeamMember]]:
        if not team_ids:
            return {}
        rows = list(
            (
                await self._session.execute(
                    select(TeamMember).where(TeamMember.team_id.in_(team_ids))
                )
            )
            .scalars()
            .all()
        )
        out: dict[UUID, list[TeamMember]] = defaultdict(list)
        for m in rows:
            out[m.team_id].append(m)
        return out

    async def _user_names(self, user_ids: set[UUID]) -> dict[UUID, str]:
        if not user_ids:
            return {}
        rows = (
            await self._session.execute(
                select(User.id, User.name, User.last_name).where(User.id.in_(user_ids))
            )
        ).all()
        return {uid: f"{name} {last}".strip() for uid, name, last in rows}


# ── Funciones puras de apoyo ─────────────────────────────────────────────────


def _passes(task: Task, f: AnalyticsFilters, subtree: set[UUID] | None) -> bool:
    if f.team_id is not None and task.team_id != f.team_id:
        return False
    if f.assignee_id is not None and task.assignee_id != f.assignee_id:
        return False
    if f.status is not None and task.status != f.status:
        return False
    if f.priority is not None and task.priority.value != f.priority:
        return False
    if subtree is not None and task.work_item_id not in subtree:
        return False
    return True


def _build_paths(items: list[WorkItem]) -> dict[UUID | None, list[str]]:
    """id de elemento -> ['Curso', 'Componente', 'Unidad'] (raíz -> él)."""
    by_id = {it.id: it for it in items}
    cache: dict[UUID, list[str]] = {}

    def path(item_id: UUID) -> list[str]:
        if item_id in cache:
            return cache[item_id]
        item = by_id.get(item_id)
        if item is None:
            return []
        parent = (
            path(item.parent_id)
            if item.parent_id is not None and item.parent_id in by_id
            else []
        )
        result = [*parent, item.nombre]
        cache[item_id] = result
        return result

    out: dict[UUID | None, list[str]] = {None: []}
    for it in items:
        out[it.id] = path(it.id)
    return out


def _subtree_ids(items: list[WorkItem], root_id: UUID) -> set[UUID]:
    children: dict[UUID | None, list[UUID]] = defaultdict(list)
    for it in items:
        children[it.parent_id].append(it.id)
    collected: set[UUID] = set()
    stack = [root_id]
    while stack:
        current = stack.pop()
        if current in collected:
            continue
        collected.add(current)
        stack.extend(children.get(current, []))
    return collected


def _throughput(
    completion_dates: list[datetime.date], today: datetime.date, weeks: int = 8
) -> list[WeekCount]:
    start_week = _monday(today) - datetime.timedelta(weeks=weeks - 1)
    counts: dict[datetime.date, int] = {
        start_week + datetime.timedelta(weeks=i): 0 for i in range(weeks)
    }
    for d in completion_dates:
        wk = _monday(d)
        if wk in counts:
            counts[wk] += 1
    return [
        WeekCount(week_start=wk.isoformat(), count=counts[wk]) for wk in sorted(counts)
    ]


def _burnup(
    tasks: list[Task],
    completion_date,
    project_start: datetime.date | None,
    project_end: datetime.date | None,
    date_from: datetime.date | None,
    date_to: datetime.date | None,
    today: datetime.date,
) -> Burnup:
    scope = sum(1 for t in tasks if t.status != TaskStatus.CANCELADA)
    starts = [t.start_date for t in tasks if t.start_date is not None]
    dues = [t.due_date for t in tasks if t.due_date is not None]
    window_start = (
        date_from
        or project_start
        or (min(starts) if starts else today - datetime.timedelta(weeks=8))
    )
    window_end = date_to or project_end or (max(dues) if dues else today)
    if window_end < window_start:
        window_end = window_start
    horizon = max(window_end, today)

    done_dates = sorted(d for t in tasks if (d := completion_date(t)) is not None)

    points: list[SeriesPoint] = []
    total_days = max((horizon - window_start).days, 1)
    cursor = _monday(window_start)
    step = datetime.timedelta(weeks=1)
    while cursor <= horizon + step:
        clamped = min(cursor, horizon)
        elapsed = max((clamped - window_start).days, 0)
        ratio = min(elapsed / total_days, 1.0) if clamped <= window_end else 1.0
        actual = sum(1 for d in done_dates if d <= clamped)
        points.append(
            SeriesPoint(
                date=clamped.isoformat(),
                ideal=round(scope * ratio, 1),
                actual=actual,
            )
        )
        if clamped == horizon:
            break
        cursor += step

    return Burnup(
        window_start=window_start.isoformat(),
        window_end=window_end.isoformat(),
        total_scope=scope,
        points=points,
    )
