"""Regla de dominio: cómo un incidente mueve la fecha de fin del proyecto.

Es pura (sin base de datos) para poder probarla y para que `apply` y `revert`
sean exactamente inversas: mover N días hacia delante y luego N hacia atrás
devuelve la fecha original.
"""

from datetime import date, timedelta

from app.shared.exceptions import ValidationError


def shift_end_date(end_date: date | None, days: int) -> date:
    """Fecha de fin desplazada `days` días (negativo = adelantar)."""
    if end_date is None:
        raise ValidationError(
            "El proyecto no tiene fecha de fin: defínela antes de reflejar el atraso"
        )
    return end_date + timedelta(days=days)
