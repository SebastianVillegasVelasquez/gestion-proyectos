"""Días laborables (lunes a viernes, sin festivos).

La reunión de producto fue explícita: el rendimiento se mide en días laborables,
no en horas de trabajo. Aquí vive el único cálculo, para que todas las métricas
del informe cuenten igual.
"""

import datetime

_WEEK = datetime.timedelta(days=7)
_DAY = datetime.timedelta(days=1)


def business_days_between(start: datetime.date, end: datetime.date) -> int:
    """Días laborables en el intervalo semiabierto ``(start, end]``.

    Cuenta lunes-viernes; ignora sábados y domingos. Devuelve un entero con
    signo: negativo si ``end`` es anterior a ``start`` (p. ej. una tarea que se
    cerró 3 días laborables ANTES de su fecha límite -> -3).
    """
    if start == end:
        return 0
    sign = -1 if end < start else 1
    lo, hi = (end, start) if end < start else (start, end)

    full_weeks, remainder = divmod((hi - lo).days, 7)
    days = full_weeks * 5

    cursor = lo
    for _ in range(remainder):
        cursor += _DAY
        if cursor.weekday() < 5:  # 0..4 = lun..vie
            days += 1
    return sign * days


def business_days_span(start: datetime.date, end: datetime.date) -> int:
    """Duración en días laborables, siempre >= 0 (ignora el orden)."""
    return abs(business_days_between(start, end))
