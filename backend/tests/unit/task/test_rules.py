import uuid
from types import SimpleNamespace

from app.modules.tasks.domain import rules
from app.modules.tasks.infrastructure.enums import TaskStatus


def _dep(depends_on_id, status):
    return SimpleNamespace(
        depends_on_id=depends_on_id,
        depends_on=SimpleNamespace(status=status),
    )


class TestIncompleteDependencies:
    def test_returns_empty_when_all_completed(self):
        deps = [
            _dep(uuid.uuid4(), TaskStatus.COMPLETADA),
            _dep(uuid.uuid4(), TaskStatus.COMPLETADA),
        ]
        assert rules.incomplete_dependency_ids(deps) == []

    def test_lists_dependencies_not_completed(self):
        blocking_id = uuid.uuid4()
        deps = [
            _dep(uuid.uuid4(), TaskStatus.COMPLETADA),
            _dep(blocking_id, TaskStatus.EN_PROGRESO),
        ]
        assert rules.incomplete_dependency_ids(deps) == [blocking_id]

    def test_treats_missing_target_as_blocking(self):
        dep_id = uuid.uuid4()
        dep = SimpleNamespace(depends_on_id=dep_id, depends_on=None)
        assert rules.incomplete_dependency_ids([dep]) == [dep_id]

    def test_in_review_still_blocks(self):
        # "Entregada" no basta: la dependencia tiene que estar COMPLETADA.
        blocking = uuid.uuid4()
        deps = [_dep(blocking, TaskStatus.EN_REVISION)]
        assert rules.incomplete_dependency_ids(deps) == [blocking]


class TestEarlierPhaseBlocks:
    def test_false_when_all_terminal(self):
        tasks = [
            SimpleNamespace(status=TaskStatus.COMPLETADA),
            SimpleNamespace(status=TaskStatus.CANCELADA),
        ]
        assert rules.earlier_phase_blocks(tasks) is False

    def test_true_when_any_open(self):
        tasks = [
            SimpleNamespace(status=TaskStatus.COMPLETADA),
            SimpleNamespace(status=TaskStatus.EN_PROGRESO),
        ]
        assert rules.earlier_phase_blocks(tasks) is True

    def test_false_when_empty(self):
        assert rules.earlier_phase_blocks([]) is False


class TestSelfDependency:
    def test_detects_self_dependency(self):
        tid = uuid.uuid4()
        assert rules.is_self_dependency(tid, tid) is True

    def test_allows_different_ids(self):
        assert rules.is_self_dependency(uuid.uuid4(), uuid.uuid4()) is False


class TestHasOpenSubtasks:
    def test_false_without_subtasks(self):
        assert rules.has_open_subtasks([]) is False

    def test_false_when_all_completed_or_cancelled(self):
        subtasks = [
            SimpleNamespace(status=TaskStatus.COMPLETADA),
            SimpleNamespace(status=TaskStatus.CANCELADA),
        ]
        assert rules.has_open_subtasks(subtasks) is False

    def test_true_when_one_still_open(self):
        subtasks = [
            SimpleNamespace(status=TaskStatus.COMPLETADA),
            SimpleNamespace(status=TaskStatus.EN_PROGRESO),
        ]
        assert rules.has_open_subtasks(subtasks) is True

    def test_en_revision_still_counts_as_open(self):
        # "Entregada" no basta: como con las dependencias, hace falta COMPLETADA.
        assert (
            rules.has_open_subtasks([SimpleNamespace(status=TaskStatus.EN_REVISION)])
            is True
        )


class TestDeliveryBlockReason:
    """Orden de las tres compuertas: dependencia directa > tercero ancestro >
    subtareas propias sin terminar. Solo la primera que aplique se reporta."""

    def test_none_when_nothing_blocks(self):
        assert rules.delivery_block_reason([], False, False) is None

    def test_open_subtasks_block_when_nothing_else_does(self):
        assert (
            rules.delivery_block_reason([], False, True)
            == rules.DELIVERY_BLOCKED_BY_OPEN_SUBTASKS
        )

    def test_dependency_takes_priority_over_open_subtasks(self):
        deps = [_dep(uuid.uuid4(), TaskStatus.EN_PROGRESO)]
        assert (
            rules.delivery_block_reason(deps, False, True)
            == rules.DELIVERY_BLOCKED_BY_DEPENDENCY
        )

    def test_third_party_takes_priority_over_open_subtasks(self):
        assert (
            rules.delivery_block_reason([], True, True)
            == rules.DELIVERY_BLOCKED_BY_THIRD_PARTY
        )

    def test_open_subtasks_defaults_to_false_for_backward_compatibility(self):
        # Los llamadores que todavía no pasan el tercer argumento (listados
        # masivos de tareas) no deben verse afectados por este cambio.
        assert rules.delivery_block_reason([], False) is None
