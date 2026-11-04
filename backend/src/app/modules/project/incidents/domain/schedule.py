"""Regla de dominio: cómo un incidente mueve la fecha de fin del proyecto.

Es pura (sin base de datos) para poder probarla y para que `apply` y `revert`
sean exactamente inversas: mover N días hacia delante y luego N hacia atrás
devuelve la fecha original.
"""

from datetime import date, timedelta

from app.shared.exceptions import ValidationError


def shift_end_date(
    end_date: date | None, days: int, *, start_date: date | None = None
) -> date:
    """Fecha de fin desplazada `days` días (negativo = adelantar).

    Si el proyecto tiene fecha de inicio, el resultado nunca puede quedar antes
    de ella: sucede al revertir un atraso después de que alguien acortó el
    proyecto a mano.
    """
    if end_date is None:
        raise ValidationError(
            "El proyecto no tiene fecha de fin: defínela antes de reflejar el atraso"
        )
    shifted = end_date + timedelta(days=days)
    if start_date is not None and shifted < start_date:
        raise ValidationError(
            "El cambio dejaría la fecha de fin antes de la fecha de inicio"
        )
    return shifted
