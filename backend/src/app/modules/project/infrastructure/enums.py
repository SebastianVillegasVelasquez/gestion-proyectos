import enum


class ProjectStatusType(str, enum.Enum):
    """
    Estados BASE fijos del sistema. Cada proyecto arranca con estos
    seeded y puede agregar estados custom adicionales a través de
    ProjectStatus con is_base=False.
    """

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    COMPLETED = "completed"
    ON_HOLD = "on_hold"
    CANCELLED = "cancelled"
    DONE = "done"
    TODO = "todo"


class NodeType(str, enum.Enum):
    PROGRAMA = "PROGRAMA"
    CURSO = "CURSO"
    MODULO = "MODULO"
