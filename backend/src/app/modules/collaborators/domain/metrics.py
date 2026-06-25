def completion_percentage(completed: int, assigned: int) -> int:
    """Porcentaje de tareas completadas sobre las asignadas (0-100, redondeado).

    Sin tareas asignadas el progreso es 0% (evita división por cero y un
    "100% de nada" engañoso).
    """
    if assigned <= 0:
        return 0
    # Acotamos por seguridad: completadas nunca debería superar a asignadas,
    # pero si los datos llegan inconsistentes no devolvemos > 100%.
    ratio = min(completed, assigned) / assigned
    return round(ratio * 100)
