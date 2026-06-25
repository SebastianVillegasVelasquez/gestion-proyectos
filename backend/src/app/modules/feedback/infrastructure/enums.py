import enum


class FeedbackStatus(str, enum.Enum):
    """Estado de gestión del feedback (lo administra el rol developer)."""

    PENDIENTE = "pendiente"  # Sin revisar (estado inicial)
    REALIZADO = "realizado"  # Atendido / implementado
    IMPOSIBLE = "imposible"  # No se puede hacer
    MAS_TARDE = "mas_tarde"  # Pospuesto para más adelante
    DESCARTADO = "descartado"  # No se hará


class FeedbackType(str, enum.Enum):
    """Tipo de feedback que el usuario clasifica al enviarlo."""

    POSITIVO = "positivo"  # Algo que funciona bien / le gusta
    NEGATIVO = "negativo"  # Un problema, error o algo que no funciona
    NUEVA_FUNCIONALIDAD = "nueva_funcionalidad"  # Pide una feature nueva
    NICE_TO_HAVE = "nice_to_have"  # Mejora deseable, no crítica
    OTRO = "otro"  # Cualquier otro comentario
