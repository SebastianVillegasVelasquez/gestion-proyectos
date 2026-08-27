import datetime
from typing import Annotated, Optional
from uuid import UUID

from pydantic import Field, StringConstraints

from app.modules.project.structure.infrastructure.enums import DuracionUnidad
from app.shared.base_model import BaseModelConfig

Nombre = Annotated[str, StringConstraints(min_length=1, max_length=200)]
NombreTipo = Annotated[str, StringConstraints(min_length=1, max_length=100)]


# ── TipoNodo ──────────────────────────────────────────────────────────────────
class CreateTipoNodoRequest(BaseModelConfig):
    nombre: NombreTipo
    color: Optional[str] = None
    icono: Optional[str] = None
    reglas_anidacion: Optional[dict] = None


class UpdateTipoNodoRequest(BaseModelConfig):
    nombre: Optional[NombreTipo] = None
    color: Optional[str] = None
    icono: Optional[str] = None
    reglas_anidacion: Optional[dict] = None


class TipoNodoResponse(BaseModelConfig):
    id: UUID
    proyecto_id: Optional[UUID] = None
    nombre: str
    color: Optional[str] = None
    icono: Optional[str] = None
    reglas_anidacion: Optional[dict] = None


# ── WorkItem ──────────────────────────────────────────────────────────────────
class CreateWorkItemRequest(BaseModelConfig):
    tipo_id: UUID
    nombre: Nombre
    parent_id: Optional[UUID] = None
    orden: Optional[int] = Field(default=None, ge=0)
    prioridad: Optional[int] = None
    fecha_inicio_plan: Optional[datetime.date] = None
    fecha_fin_plan: Optional[datetime.date] = None
    duracion_valor: Optional[int] = Field(default=None, gt=0)
    duracion_unidad: Optional[DuracionUnidad] = None
    fecha_inicio_real: Optional[datetime.date] = None
    fecha_fin_real: Optional[datetime.date] = None
    porcentaje_completado: Optional[float] = Field(default=None, ge=0, le=1)
    es_transversal: bool = False


class UpdateWorkItemRequest(BaseModelConfig):
    nombre: Optional[Nombre] = None
    tipo_id: Optional[UUID] = None
    orden: Optional[int] = Field(default=None, ge=0)
    prioridad: Optional[int] = None
    fecha_inicio_plan: Optional[datetime.date] = None
    fecha_fin_plan: Optional[datetime.date] = None
    duracion_valor: Optional[int] = Field(default=None, gt=0)
    duracion_unidad: Optional[DuracionUnidad] = None
    fecha_inicio_real: Optional[datetime.date] = None
    fecha_fin_real: Optional[datetime.date] = None
    porcentaje_completado: Optional[float] = Field(default=None, ge=0, le=1)
    es_transversal: Optional[bool] = None


class WorkItemResponse(BaseModelConfig):
    id: UUID
    proyecto_id: UUID
    parent_id: Optional[UUID] = None
    tipo_id: UUID
    nombre: str
    orden: int
    prioridad: Optional[int] = None
    fecha_inicio_plan: Optional[datetime.date] = None
    fecha_fin_plan: Optional[datetime.date] = None
    duracion_valor: Optional[int] = None
    duracion_unidad: Optional[DuracionUnidad] = None
    fecha_inicio_real: Optional[datetime.date] = None
    fecha_fin_real: Optional[datetime.date] = None
    porcentaje_completado: Optional[float] = None
    es_transversal: bool
    # True cuando el motor derivó fechas con datos inconsistentes (3 valores que
    # no cuadran): prevalece el par de fechas, pero se avisa. Solo informativo y
    # transitorio (no se persiste); en lecturas siempre es False.
    advertencia_fechas: bool = False
    # True cuando este elemento termina DESPUÉS que su padre. No bloquea nada:
    # se puede recolocar y planificar libremente, y la UI marca el conflicto
    # para que alguien decida si se recorta el hijo o se extiende el padre.
    # Derivado en lectura (no se persiste): desaparece solo al cuadrar fechas.
    conflicto_fechas: bool = False


class WorkItemTreeResponse(WorkItemResponse):
    children: list["WorkItemTreeResponse"] = []


class TrashedItemResponse(BaseModelConfig):
    """Un elemento borrado, tal como se ve en la papelera del proyecto.

    Se listan solo las raíces de cada borrado (lo que se borró explícitamente),
    con `contenido` = cuántos elementos volverían con él.
    """

    id: UUID
    nombre: str
    tipo_nombre: Optional[str] = None
    deleted_at: Optional[datetime.datetime] = None
    contenido: int = 0


# ── Clonado de subárbol (copiar / pegar) ──────────────────────────────────────
class CloneWorkItemRequest(BaseModelConfig):
    """Pega un subárbol bajo `target_parent_id` (null = raíz del proyecto).

    - `offset_days`: desplazamiento (puede ser negativo) que se suma a todas las
      fechas plan del subárbol clonado. Cero = mismas fechas que el origen.
    - `rename_root_to`: nombre opcional para el nodo raíz del clon (los hijos
      conservan sus nombres). Si es nulo, se mantiene el del origen.

    El clonado replica solo dentro del mismo proyecto. Las dependencias FtS
    *internas* al subárbol se preservan; las externas se descartan. Se
    RESETEAN: fechas reales y porcentaje completado.

    - `times`: cuántas copias pegar (por defecto 1). Útil para replicar la misma
      estructura muchas veces (p. ej. 32 cursos idénticos) en una sola acción.
    - `include_tasks`: si se copian también las tareas colgadas del subárbol, con
      su responsable/equipo (deep copy). El estado y las fechas reales se
      resetean; las fechas plan se desplazan igual que la estructura.
    """

    target_parent_id: Optional[UUID] = None
    offset_days: int = 0
    rename_root_to: Optional[Nombre] = None
    times: int = Field(default=1, ge=1, le=100)
    include_tasks: bool = True


# ── Mover / reordenar un nodo (drag & drop del árbol) ─────────────────────────
class MoveWorkItemRequest(BaseModelConfig):
    """Recoloca un nodo bajo otro padre (o a la raíz) y/o cambia su orden.

    - `new_parent_id`: nuevo padre; `null` = mover al nivel raíz del proyecto.
    - `orden`: posición entre hermanos; si se omite, va al final.

    No puede moverse dentro de sí mismo ni de un descendiente (crearía un ciclo),
    ni a otro proyecto. Las fechas se re-derivan solas en lectura.
    """

    new_parent_id: Optional[UUID] = None
    orden: Optional[int] = Field(default=None, ge=0)


# ── Desplazar un subárbol en el tiempo (drag de la barra en el cronograma) ─────
class ShiftWorkItemSubtreeRequest(BaseModelConfig):
    """Suma `offset_days` (puede ser negativo) a las fechas plan de TODO el
    subárbol y, si `shift_tasks`, a las fechas de sus tareas. Cero = sin cambios.

    Reprograma el bloque completo conservando su forma interna (útil cuando un
    evento se corre en el calendario). Las fechas reales y el avance no se tocan.
    """

    offset_days: int
    shift_tasks: bool = True


# ── Dependencias Finish-to-Start ──────────────────────────────────────────────
class WorkItemDependencyRequest(BaseModelConfig):
    depends_on_id: UUID


class WorkItemDependencyResponse(BaseModelConfig):
    id: UUID
    work_item_id: UUID
    depends_on_id: UUID
