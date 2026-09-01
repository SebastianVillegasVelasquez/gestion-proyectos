"""`reschedule_task_start`: cómo se mueve el inicio de una tarea y se recalcula
su fin cuando una dependencia (actividad de terceros u otra tarea) se abre.

- Sin `recompute_due_from_estimate` (arrastre de barra en el Gantt): si hay
  inicio y fin, se conserva la duración (delta-shift).
- Con `recompute_due_from_estimate` (cascada de dependencias): si hay
  `estimated_days`, el fin SIEMPRE pasa a ser `nuevo inicio + días estimados`.
"""

from datetime import date, timedelta
from types import SimpleNamespace

from app.modules.tasks.domain.services import reschedule_task_start


def _task(*, start=None, due=None, estimated_days=None) -> SimpleNamespace:
    return SimpleNamespace(
        start_date=start, due_date=due, estimated_days=estimated_days
    )


NEW_START = date(2026, 3, 10)


class TestDeltaShiftDefault:
    def test_start_and_due_set_no_estimate_preserves_duration(self):
        t = _task(start=date(2026, 3, 1), due=date(2026, 3, 6))  # 5 días
        assert reschedule_task_start(t, NEW_START) is True
        assert t.start_date == NEW_START
        assert t.due_date == NEW_START + timedelta(days=5)

    def test_no_due_but_estimate_fills_from_estimate(self):
        t = _task(start=date(2026, 3, 1), estimated_days=4)
        assert reschedule_task_start(t, NEW_START) is True
        assert t.due_date == NEW_START + timedelta(days=4)

    def test_flag_off_keeps_delta_shift_even_with_estimate(self):
        # Fin a mano (10 días) distinto del estimado (4): sin el flag NO se toca.
        t = _task(start=date(2026, 3, 1), due=date(2026, 3, 11), estimated_days=4)
        reschedule_task_start(t, NEW_START)
        assert t.due_date == NEW_START + timedelta(days=10)

    def test_no_change_returns_false(self):
        t = _task(start=NEW_START, due=NEW_START + timedelta(days=3))
        assert reschedule_task_start(t, NEW_START) is False


class TestRecomputeFromEstimate:
    def test_overrides_hand_set_due_with_estimate(self):
        t = _task(start=date(2026, 3, 1), due=date(2026, 3, 11), estimated_days=4)
        assert (
            reschedule_task_start(t, NEW_START, recompute_due_from_estimate=True)
            is True
        )
        assert t.start_date == NEW_START
        assert t.due_date == NEW_START + timedelta(days=4)

    def test_start_unchanged_but_due_recomputed(self):
        t = _task(start=NEW_START, due=date(2026, 4, 1), estimated_days=3)
        assert (
            reschedule_task_start(t, NEW_START, recompute_due_from_estimate=True)
            is True
        )
        assert t.due_date == NEW_START + timedelta(days=3)

    def test_no_estimate_falls_back_to_delta_shift(self):
        t = _task(start=date(2026, 3, 1), due=date(2026, 3, 6))
        assert (
            reschedule_task_start(t, NEW_START, recompute_due_from_estimate=True)
            is True
        )
        assert t.due_date == NEW_START + timedelta(days=5)

    def test_idempotent_when_already_at_estimate(self):
        t = _task(
            start=NEW_START,
            due=NEW_START + timedelta(days=4),
            estimated_days=4,
        )
        assert (
            reschedule_task_start(t, NEW_START, recompute_due_from_estimate=True)
            is False
        )
