import enum


class NodeType(str, enum.Enum):
    PROGRAMA = "PROGRAMA"
    CURSO = "CURSO"
    MODULO = "MODULO"


class ProjectRole(str, enum.Enum):
    """Roles contextuales dentro de los proyectos.

    Dictan la jerarquía del flujo de trabajo y la trazabilidad de tareas.
    """

    SUPERVISOR = "supervisor"  # Monitorea entregas y tiempos (ideal para la auditoría de tus jefes).
    COORDINADOR = "coordinador"  # Líder del proyecto, asigna tareas, maneja el Gantt y aprueba entregas.
    REVISOR = "revisor"  # Encargado de la revisión intermedia (control de calidad antes de completar).
    INTEGRANTE = "integrante"  # El colaborador operativo encargado de ejecutar las tareas asignadas.
    CLIENTE = (
        "cliente"  # Stakeholder/Usuario final con permisos de observación o feedback.
    )
