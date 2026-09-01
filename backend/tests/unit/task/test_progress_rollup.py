"""Avance de una tarea: por estado si no tiene subtareas; promedio del de sus
subtareas si las tiene, sin llegar a 100 hasta aprobarse el entregable padre
(`compute_task_progress`, `TaskService._rollup_progress`, `progress_by_id`).
"""

import uuid
from types import SimpleNamespace

from app.modules.tasks.domain.services import (
    TaskService,
    compute_task_progress,
    progress_by_id,
)
from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.tasks.presentation.schemas import TaskResponse

PROJECT = uuid.uuid4()
S = TaskStatus


def _resp(
    status=S.PENDIENTE_POR_INICIAR, parent=None, requires_approval=False
) -> TaskResponse:
    return TaskResponse(
        id=uuid.uuid4(),
        project_id=PROJECT,
        parent_task_id=parent,
        title="Tarea",
        status=status,
        requires_approval=requires_approval,
    )


class TestComputeTaskProgress:
    def test_leaf_by_status(self):
        assert compute_task_progress(S.PENDIENTE_POR_INICIAR, False) == 0
        assert compute_task_progress(S.EN_PROGRESO, False) == 35
        assert compute_task_progress(S.EN_REVISION, False) == 70
        assert compute_task_progress(S.COMPLETADA, False) == 100

    def test_parent_is_the_average_of_children(self):
        assert compute_task_progress(S.EN_PROGRESO, False, [0, 100]) == 50
        assert compute_task_progress(S.EN_PROGRESO, False, [100, 100, 0]) == 67

    def test_parent_needing_approval_stops_at_99_until_completed(self):
        assert compute_task_progress(S.EN_REVISION, True, [100, 100]) == 99
        assert compute_task_progress(S.COMPLETADA, True, [100, 100]) == 100

    def test_parent_without_approval_reaches_100(self):
        assert compute_task_progress(S.EN_PROGRESO, False, [100, 100]) == 100


class TestRollupProgress:
    def test_parent_pct_follows_children(self):
        parent = _resp(S.EN_PROGRESO)
        c1 = _resp(S.COMPLETADA, parent=parent.id)
        c2 = _resp(S.PENDIENTE_POR_INICIAR, parent=parent.id)

        TaskService._rollup_progress([parent, c1, c2])

        assert parent.progress_pct == 50

    def test_leaf_keeps_its_status_pct(self):
        parent = _resp(S.EN_PROGRESO)
        c1 = _resp(S.EN_PROGRESO, parent=parent.id)

        TaskService._rollup_progress([parent, c1])

        assert c1.progress_pct == 35


class TestProgressById:
    def test_flat_list_rolls_up(self):
        parent = SimpleNamespace(
            id=uuid.uuid4(),
            parent_task_id=None,
            status=S.EN_PROGRESO,
            requires_approval=False,
        )
        kid = SimpleNamespace(
            id=uuid.uuid4(),
            parent_task_id=parent.id,
            status=S.COMPLETADA,
            requires_approval=False,
        )

        got = progress_by_id([parent, kid])

        assert got[kid.id] == 100
        assert got[parent.id] == 100
