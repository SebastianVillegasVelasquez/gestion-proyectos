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


class WorkItemTreeResponse(WorkItemResponse):
    children: list["WorkItemTreeResponse"] = []


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
    """

    target_parent_id: Optional[UUID] = None
    offset_days: int = 0
    rename_root_to: Optional[Nombre] = None


# ── Dependencias Finish-to-Start ──────────────────────────────────────────────
class WorkItemDependencyRequest(BaseModelConfig):
    depends_on_id: UUID


class WorkItemDependencyResponse(BaseModelConfig):
    id: UUID
    work_item_id: UUID
    depends_on_id: UUID
