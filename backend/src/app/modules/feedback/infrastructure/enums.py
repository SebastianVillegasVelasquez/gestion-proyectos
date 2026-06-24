import enum


class FeedbackType(str, enum.Enum):
    """Tipo de feedback que el usuario clasifica al enviarlo."""

    POSITIVO = "positivo"  # Algo que funciona bien / le gusta
    NEGATIVO = "negativo"  # Un problema, error o algo que no funciona
    NUEVA_FUNCIONALIDAD = "nueva_funcionalidad"  # Pide una feature nueva
    NICE_TO_HAVE = "nice_to_have"  # Mejora deseable, no crítica
    OTRO = "otro"  # Cualquier otro comentario
