"""Motor de derivación de fechas de un nodo de trabajo (lógica pura).

Un nodo puede definir su tiempo de tres maneras y el sistema deriva lo que
falte (§4 de la especificación). Es una función pura (sin BD ni ORM): misma
entrada → misma salida, fácil de testear y reutilizar.
"""

import datetime
from dataclasses import dataclass

from app.modules.project.structure.infrastructure.enums import DuracionUnidad


def duration_in_days(valor: int | None, unidad: DuracionUnidad | None) -> int | None:
    """Convierte una duración a días. `semanas` = 7 días; `dias` = 1."""
    if valor is None or unidad is None:
        return None
    factor = 7 if unidad == DuracionUnidad.SEMANAS else 1
    return valor * factor


@dataclass(frozen=True)
class DerivedDates:
    fecha_inicio_plan: datetime.date | None
    fecha_fin_plan: datetime.date | None
    # True si se dieron los tres valores (inicio, fin y duración) y no cuadran:
    # prevalece el par fecha-fecha y se marca esta advertencia.
    advertencia: bool = False


def derive_dates(
    *,
    fecha_inicio_plan: datetime.date | None,
    fecha_fin_plan: datetime.date | None,
    duracion_valor: int | None,
    duracion_unidad: DuracionUnidad | None,
    predecessor_end: datetime.date | None = None,
    parent_start: datetime.date | None = None,
) -> DerivedDates:
    """Deriva las fechas plan faltantes a partir de lo que el usuario aportó.

    - Modo 1 (inicio + duración) → calcula el fin.
    - Modo 2 (fin + duración) → calcula el inicio.
    - Modo 3 (solo duración) → hereda la posición del predecesor FtS
      (`fin + 1`) o, si no hay, del inicio del padre.
    - Par fecha-fecha → prevalece; si además hay una duración que no cuadra,
      se marca `advertencia`.
    """
    dur = duration_in_days(duracion_valor, duracion_unidad)
    delta = datetime.timedelta(days=dur) if dur is not None else None
    inicio, fin = fecha_inicio_plan, fecha_fin_plan

    # Par fecha-fecha: prevalece. Advertencia si la duración no es coherente.
    if inicio is not None and fin is not None:
        advertencia = delta is not None and fin != inicio + delta
        return DerivedDates(inicio, fin, advertencia)

    # Modo 1: inicio + duración → fin.
    if inicio is not None and delta is not None:
        return DerivedDates(inicio, inicio + delta, False)

    # Modo 2: fin + duración → inicio.
    if fin is not None and delta is not None:
        return DerivedDates(fin - delta, fin, False)

    # Modo 3: solo duración → posición heredada.
    if delta is not None:
        if predecessor_end is not None:
            base = predecessor_end + datetime.timedelta(days=1)
        else:
            base = parent_start
        if base is not None:
            return DerivedDates(base, base + delta, False)
        return DerivedDates(None, None, False)

    # Datos incompletos (solo inicio, solo fin o nada): se devuelve tal cual.
    return DerivedDates(inicio, fin, False)


def viola_fts(
    inicio: datetime.date | None, predecessor_end: datetime.date | None
) -> bool:
    """Finish-to-Start: un nodo no puede iniciar antes (o el mismo día) de que
    termine su predecesor. Devuelve True si la fecha de inicio lo viola."""
    return (
        inicio is not None and predecessor_end is not None and inicio <= predecessor_end
    )
