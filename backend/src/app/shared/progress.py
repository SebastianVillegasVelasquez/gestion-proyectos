"""Regla pura de avance por tareas (sin BD ni FastAPI), compartida por los
distintos read models que agregan avance (colaborador, equipo)."""


def completion_percentage(completed: int, assigned: int) -> int:
    """Porcentaje de tareas completadas sobre las asignadas (0-100, redondeado).

    Sin tareas asignadas el avance es 0% (evita división por cero).
    """
    if assigned <= 0:
        return 0
    ratio = min(completed, assigned) / assigned
    return round(ratio * 100)
