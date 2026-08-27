import enum


class ProjectRole(str, enum.Enum):
    """Roles contextuales dentro de los proyectos.

    Dictan la jerarquía del flujo de trabajo y la trazabilidad de tareas.
    """

    SUPERVISOR = "supervisor"  # Monitorea entregas y tiempos (ideal para la auditoría de tus jefes).
    COORDINADOR = "coordinador"  # Líder del proyecto, asigna tareas, maneja el Gantt y aprueba entregas.
    REVISOR = "revisor"  # Encargado de la revisión intermedia (control de calidad antes de completar).
    INTEGRANTE = "integrante"  # El colaborador operativo encargado de ejecutar las tareas asignadas.
    # No hay rol de cliente: el cliente NO tiene cuenta en el sistema. Ve el
    # avance por el portal público (/portal/{token}), que es de solo lectura y
    # no pasa por login; darle un rol de proyecto sería una segunda puerta de
    # entrada para el mismo caso de uso.
