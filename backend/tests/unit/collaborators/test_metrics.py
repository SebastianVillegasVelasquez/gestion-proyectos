import pytest

from app.modules.collaborators.domain.metrics import completion_percentage


class TestCompletionPercentage:
    def test_should_return_zero_when_no_tasks_assigned(self):
        assert completion_percentage(completed=0, assigned=0) == 0

    def test_should_return_zero_when_assigned_is_negative(self):
        # Datos inconsistentes no deben provocar división por cero ni negativos.
        assert completion_percentage(completed=3, assigned=-1) == 0

    def test_should_compute_half(self):
        assert completion_percentage(completed=5, assigned=10) == 50

    def test_should_round_to_nearest_integer(self):
        # 1/3 → 33.33% → 33
        assert completion_percentage(completed=1, assigned=3) == 33

    def test_should_return_full_when_all_completed(self):
        assert completion_percentage(completed=4, assigned=4) == 100

    def test_should_cap_at_hundred_when_data_is_inconsistent(self):
        # Más completadas que asignadas no debe superar el 100%.
        assert completion_percentage(completed=9, assigned=4) == 100

    @pytest.mark.parametrize(
        "completed,assigned,expected",
        [(0, 5, 0), (2, 8, 25), (7, 10, 70), (10, 10, 100)],
    )
    def test_table_of_cases(self, completed, assigned, expected):
        assert completion_percentage(completed, assigned) == expected
