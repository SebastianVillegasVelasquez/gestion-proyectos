import pytest

from app.modules.areas.domain.metrics import completion_percentage


class TestCompletionPercentage:
    def test_zero_when_no_tasks(self):
        assert completion_percentage(0, 0) == 0

    def test_half(self):
        assert completion_percentage(5, 10) == 50

    def test_rounds(self):
        assert completion_percentage(1, 3) == 33

    def test_caps_at_hundred(self):
        assert completion_percentage(9, 4) == 100

    @pytest.mark.parametrize(
        "completed,assigned,expected",
        [(0, 4, 0), (3, 12, 25), (4, 4, 100)],
    )
    def test_cases(self, completed, assigned, expected):
        assert completion_percentage(completed, assigned) == expected
