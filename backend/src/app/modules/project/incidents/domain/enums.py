import enum


class IncidentResponsible(str, enum.Enum):
    """A quién se le atribuye el incidente (de quién fue la causa)."""

    CLIENTE = "cliente"
    EQUIPO = "equipo"
    TERCERO = "tercero"
