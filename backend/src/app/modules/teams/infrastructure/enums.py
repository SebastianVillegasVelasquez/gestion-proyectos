import enum


class TeamRole(str, enum.Enum):
    """Rol de una persona DENTRO de un equipo (distinto del rol de proyecto)."""

    LIDER = "lider"
    SUPERVISOR = "supervisor"
    INTEGRANTE = "integrante"


class InvitationStatus(str, enum.Enum):
    """Estado de una invitación a un equipo.

    El líder invita a un integrante del proyecto; la persona no entra al equipo
    hasta que acepta (evita traslapes de asignación entre equipos).
    """

    PENDIENTE = "pendiente"
    ACEPTADA = "aceptada"
    RECHAZADA = "rechazada"
