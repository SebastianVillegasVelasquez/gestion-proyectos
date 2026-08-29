import enum


class ReminderChannel(str, enum.Enum):
    """Por dónde avisar cuando llega la hora del recordatorio."""

    NOTIFICACION = "notificacion"
    CORREO = "correo"
    AMBOS = "ambos"


class ReminderStatus(str, enum.Enum):
    PENDIENTE = "pendiente"
    ENVIADO = "enviado"
    CANCELADO = "cancelado"
