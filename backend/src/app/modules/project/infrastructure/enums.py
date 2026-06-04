import enum

class ProjectStatusType(str, enum.Enum):
    """
    Estados BASE fijos del sistema. Cada proyecto arranca con estos
    seeded y puede agregar estados custom adicionales a través de
    ProjectStatus con is_base=False.
    """

    PENDING = "pending"  # Por iniciar
    IN_PROGRESS = "in_progress"  # En progreso
    IN_REVIEW = "in_review"  # En revisión
    COMPLETED = "completed"  # Completado
    ON_HOLD = "on_hold"  # En pausa
    CANCELLED = "cancelled"  # Cancelado
    DONE = "done"
    TODO = "todo"


class RiskLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ProjectMemberRole(str, enum.Enum):
    """Rol dentro de un proyecto específico (diferente al rol global)."""

    ADMIN = "admin"
    COORDINATOR = "coordinator"
    MEMBER = "member"
    OBSERVER = "observer"