"""Avance declarado por el responsable: reglas puras de dominio.

El porcentaje manual solo cuenta en tareas SIN subtareas y mientras estén
abiertas; el estado terminal (COMPLETADA / CANCELADA) siempre manda.
"""

import uuid
from types import SimpleNamespace

from app.modules.tasks.domain import rules
from app.modules.tasks.domain.services import compute_task_progress, progress_by_id
from app.modules.tasks.infrastructure.enums import TaskStatus

S = TaskStatus


def _node(parent_id=None, status=S.EN_PROGRESO, manual=None):
    return SimpleNamespace(
        id=uuid.uuid4(),
        parent_task_id=parent_id,
        status=status,
        requires_approval=False,
        manual_progress_pct=manual,
    )


class TestManualProgress:
    def test_manual_overrides_the_status_scale_while_open(self):
        assert compute_task_progress(S.EN_PROGRESO, False, manual_pct=60) == 60
        assert compute_task_progress(S.DEVUELTA, False, manual_pct=20) == 20

    def test_without_manual_value_the_status_scale_applies(self):
        assert compute_task_progress(S.EN_PROGRESO, False, manual_pct=None) == 35

    def test_terminal_status_beats_the_declared_value(self):
        assert compute_task_progress(S.COMPLETADA, False, manual_pct=40) == 100
        assert compute_task_progress(S.CANCELADA, False, manual_pct=40) == 0

    def test_a_parent_ignores_its_own_manual_value(self):
        assert (
            compute_task_progress(S.EN_PROGRESO, False, [0, 100], manual_pct=90) == 50
        )

    def test_rollup_uses_the_declared_value_of_each_leaf(self):
        parent = _node()
        leaf_a = _node(parent.id, manual=80)
        leaf_b = _node(parent.id, status=S.PENDIENTE_POR_INICIAR)
        out = progress_by_id([parent, leaf_a, leaf_b])
        assert out[leaf_a.id] == 80
        assert out[parent.id] == 40


class TestProgressEditGate:
    def test_editable_only_while_working(self):
        assert rules.progress_edit_block_reason(S.EN_PROGRESO, False) is None
        assert rules.progress_edit_block_reason(S.DEVUELTA, False) is None

    def test_blocked_reasons(self):
        assert (
            rules.progress_edit_block_reason(S.PENDIENTE_POR_INICIAR, False)
            == rules.PROGRESS_LOCKED_NOT_STARTED
        )
        assert (
            rules.progress_edit_block_reason(S.EN_REVISION, False)
            == rules.PROGRESS_LOCKED_IN_REVIEW
        )
        assert (
            rules.progress_edit_block_reason(S.COMPLETADA, False)
            == rules.PROGRESS_LOCKED_CLOSED
        )

    def test_a_parent_with_subtasks_is_never_editable(self):
        assert (
            rules.progress_edit_block_reason(S.EN_PROGRESO, True)
            == rules.PROGRESS_LOCKED_BY_SUBTASKS
        )
