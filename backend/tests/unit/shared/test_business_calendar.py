import datetime

from app.shared.business_calendar import business_days_between, business_days_span

MON = datetime.date(2026, 8, 24)  # lunes
TUE = datetime.date(2026, 8, 25)
FRI = datetime.date(2026, 8, 28)
NEXT_MON = datetime.date(2026, 8, 31)
NEXT_FRI = datetime.date(2026, 9, 4)


class TestBusinessDaysBetween:
    def test_same_day_is_zero(self):
        assert business_days_between(MON, MON) == 0

    def test_consecutive_weekdays(self):
        assert business_days_between(MON, TUE) == 1
        assert business_days_between(MON, FRI) == 4

    def test_skips_the_weekend(self):
        # viernes -> lunes: solo cuenta el lunes.
        assert business_days_between(FRI, NEXT_MON) == 1

    def test_full_week_is_five(self):
        assert business_days_between(MON, NEXT_MON) == 5
        assert business_days_between(MON, NEXT_FRI) == 9

    def test_signed_when_end_is_earlier(self):
        assert business_days_between(NEXT_MON, MON) == -5
        assert business_days_between(TUE, MON) == -1

    def test_span_is_absolute(self):
        assert business_days_span(NEXT_MON, MON) == 5
        assert business_days_span(MON, NEXT_MON) == 5
