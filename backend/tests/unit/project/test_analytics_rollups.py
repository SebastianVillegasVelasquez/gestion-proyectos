"""Agregaciones puras de la analítica: salud, avance frente al plan y estado por
componente (sumando todo el subárbol, contando también lo ya empezado)."""

import datetime
import uuid
from types import SimpleNamespace

from app.modules.project.application.analytics_rollups import (
    ComponentState,
    PlanStatus,
    build_component_stats,
    build_health,
    build_plan_progress,
    task_health,
)
from app.modules.tasks.infrastructure.enums import TaskStatus

S = TaskStatus
TODAY = datetime.date(2026, 10, 14)  # miércoles


def _task(status=S.PENDIENTE_POR_INICIAR, due=None, item=None):
    return SimpleNamespace(
        id=uuid.uuid4(), status=status, due_date=due, work_item_id=item
    )


def _item(name, parent=None, orden=0):
    return SimpleNamespace(
        id=uuid.uuid4(), nombre=name, parent_id=parent, orden=orden, tipo_id=None
    )


class TestTaskHealth:
    def test_closed_tasks_keep_their_own_state(self):
        assert task_health(_task(S.COMPLETADA), TODAY).value == "completed"
        assert task_health(_task(S.CANCELADA), TODAY).value == "cancelled"

    def test_open_task_past_due_is_overdue(self):
        late = _task(S.EN_PROGRESO, due=TODAY - datetime.timedelta(days=1))
        assert task_health(late, TODAY).value == "overdue"

    def test_open_task_due_within_the_week_is_at_risk(self):
        soon = _task(S.EN_PROGRESO, due=TODAY + datetime.timedelta(days=2))
        assert task_health(soon, TODAY).value == "at_risk"

    def test_far_or_undated_tasks_are_on_track(self):
        far = _task(due=TODAY + datetime.timedelta(days=60))
        assert task_health(far, TODAY).value == "on_track"
        assert task_health(_task(), TODAY).value == "on_track"

    def test_breakdown_excludes_cancelled_from_the_total(self):
        tasks = [_task(S.COMPLETADA), _task(S.CANCELADA), _task()]
        h = build_health(tasks, TODAY)
        assert (h.total, h.completed, h.on_track) == (2, 1, 1)


class TestPlanProgress:
    def test_expected_counts_tasks_already_due(self):
        past = TODAY - datetime.timedelta(days=3)
        tasks = [
            _task(S.COMPLETADA, due=past),
            _task(S.EN_PROGRESO, due=past),
            _task(S.PENDIENTE_POR_INICIAR, due=TODAY + datetime.timedelta(days=9)),
            _task(S.PENDIENTE_POR_INICIAR),  # sin fecha: nadie la espera aún
        ]
        plan = build_plan_progress(
            tasks, datetime.date(2026, 9, 1), datetime.date(2026, 12, 1), TODAY
        )
        assert plan.expected_tasks == 2
        assert plan.expected_pct == 50
        assert plan.completed_pct == 25
        assert plan.gap_pts == 25
        assert plan.status is PlanStatus.AT_RISK

    def test_on_track_when_real_matches_the_plan(self):
        past = TODAY - datetime.timedelta(days=3)
        tasks = [_task(S.COMPLETADA, due=past), _task(S.COMPLETADA, due=past)]
        plan = build_plan_progress(
            tasks, datetime.date(2026, 9, 1), datetime.date(2026, 12, 1), TODAY
        )
        assert plan.gap_pts == 0
        assert plan.status is PlanStatus.ON_TRACK

    def test_timeline_position_is_clamped_to_the_window(self):
        plan = build_plan_progress(
            [], datetime.date(2026, 11, 1), datetime.date(2026, 12, 1), TODAY
        )
        assert plan.day_index == 0
        assert plan.total_days == 30


class TestComponentStats:
    def _build(self, items, tasks, progress=None):
        return build_component_stats(
            items,
            tasks,
            progress or {},
            {i.id: [i.nombre] for i in items},
            {},
            TODAY,
        )

    def test_a_parent_sums_everything_that_hangs_from_it_in_tree_order(self):
        curso = _item("Curso")
        modulo = _item("Módulo", parent=curso.id)
        tasks = [
            _task(S.COMPLETADA, item=modulo.id),
            _task(S.EN_PROGRESO, item=modulo.id),
            _task(S.PENDIENTE_POR_INICIAR, item=curso.id),
        ]
        rows = self._build([modulo, curso], tasks)  # desordenado a propósito

        assert [r.name for r in rows] == ["Curso", "Módulo"]
        assert [r.depth for r in rows] == [0, 1]
        parent, child = rows
        assert (parent.total, parent.direct_tasks, parent.child_count) == (3, 1, 1)
        assert (child.total, child.direct_tasks) == (2, 2)
        assert parent.completed_pct == 33
        assert parent.started_pct == 33

    def test_started_progress_counts_partial_work(self):
        curso = _item("Curso")
        done = _task(S.COMPLETADA, item=curso.id)
        working = _task(S.EN_PROGRESO, item=curso.id)
        idle = _task(S.PENDIENTE_POR_INICIAR, item=curso.id)
        rows = self._build(
            [curso], [done, working, idle], {done.id: 100, working.id: 60, idle.id: 0}
        )
        c = rows[0]
        assert c.progress_pct == round((100 + 60 + 0) / 3)  # cuenta lo empezado
        assert c.started_progress_pct == 60  # cuánto llevan las iniciadas
        assert c.completed_pct == 33

    def test_states(self):
        past = TODAY - datetime.timedelta(days=2)
        soon = TODAY + datetime.timedelta(days=1)
        empty, done, late, risky, working, idle = (
            _item(n) for n in ("a", "b", "c", "d", "e", "f")
        )
        tasks = [
            _task(S.COMPLETADA, item=done.id),
            _task(S.EN_PROGRESO, due=past, item=late.id),
            _task(S.EN_PROGRESO, due=soon, item=risky.id),
            _task(S.EN_PROGRESO, item=working.id),
            _task(S.PENDIENTE_POR_INICIAR, item=idle.id),
        ]
        by_name = {
            r.name: r.state
            for r in self._build([empty, done, late, risky, working, idle], tasks)
        }
        assert by_name == {
            "a": ComponentState.EMPTY,
            "b": ComponentState.COMPLETED,
            "c": ComponentState.OVERDUE,
            "d": ComponentState.AT_RISK,
            "e": ComponentState.IN_PROGRESS,
            "f": ComponentState.NOT_STARTED,
        }

    def test_cancelled_tasks_do_not_count(self):
        curso = _item("Curso")
        rows = self._build(
            [curso],
            [_task(S.CANCELADA, item=curso.id), _task(S.COMPLETADA, item=curso.id)],
        )
        assert (rows[0].total, rows[0].state) == (1, ComponentState.COMPLETED)

    def test_restricting_to_a_branch_drops_the_rest(self):
        a, b = _item("A"), _item("B")
        child = _item("A1", parent=a.id)
        rows = build_component_stats(
            [a, b, child], [], {}, {}, {}, TODAY, only_subtree={a.id, child.id}
        )
        assert [r.name for r in rows] == ["A", "A1"]
