"""El estimado de una tarea con subtareas es el total de las suyas cuando el
padre no fijó uno propio (`TaskService._rollup_estimates`).
"""

import uuid
from decimal import Decimal

from app.modules.tasks.domain.services import TaskService
from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.tasks.presentation.schemas import TaskResponse

PROJECT = uuid.uuid4()


def _task(estimated=None, parent=None) -> TaskResponse:
    return TaskResponse(
        id=uuid.uuid4(),
        project_id=PROJECT,
        parent_task_id=parent,
        title="Tarea",
        status=TaskStatus.PENDIENTE_POR_INICIAR,
        estimated_days=None if estimated is None else Decimal(str(estimated)),
    )


def test_parent_without_estimate_gets_the_sum_of_children():
    parent = _task()
    c1 = _task("2", parent=parent.id)
    c2 = _task("3", parent=parent.id)

    TaskService._rollup_estimates([parent, c1, c2])

    assert parent.estimated_days == Decimal("5")


def test_explicit_parent_estimate_is_kept():
    parent = _task("10")
    c1 = _task("2", parent=parent.id)

    TaskService._rollup_estimates([parent, c1])

    assert parent.estimated_days == Decimal("10")


def test_rolls_up_through_several_levels():
    root = _task()
    mid = _task(parent=root.id)
    leaf1 = _task("1", parent=mid.id)
    leaf2 = _task("4", parent=mid.id)

    TaskService._rollup_estimates([root, mid, leaf1, leaf2])

    assert mid.estimated_days == Decimal("5")
    assert root.estimated_days == Decimal("5")


def test_no_change_when_no_child_has_an_estimate():
    parent = _task()
    c1 = _task(parent=parent.id)

    TaskService._rollup_estimates([parent, c1])

    assert parent.estimated_days is None


def test_subtree_whose_parent_is_not_in_the_list_still_rolls_up():
    # p. ej. la lista viene filtrada y el padre de más arriba no está.
    orphan_parent_id = uuid.uuid4()
    mid = _task(parent=orphan_parent_id)
    leaf = _task("7", parent=mid.id)

    TaskService._rollup_estimates([mid, leaf])

    assert mid.estimated_days == Decimal("7")
