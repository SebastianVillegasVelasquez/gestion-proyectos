import enum


class TeamRole(str, enum.Enum):
    """Rol de una persona DENTRO de un equipo (distinto del rol de proyecto)."""

    LIDER = "lider"
    SUPERVISOR = "supervisor"
    INTEGRANTE = "integrante"
