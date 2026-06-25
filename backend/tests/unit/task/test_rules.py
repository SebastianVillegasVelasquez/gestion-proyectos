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
