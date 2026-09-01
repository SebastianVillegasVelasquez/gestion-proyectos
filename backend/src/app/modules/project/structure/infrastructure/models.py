from __future__ import annotations

import datetime
import uuid
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UUID,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.modules.project.structure.infrastructure.enums import DuracionUnidad
from app.shared.base_database import Base
from app.shared.base_entity import SoftDeleteMixin, TimestampMixin, UUIDMixin


class TipoNodo(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Catálogo de tipos de nodo configurable por proyecto.

    `proyecto_id` nulo = plantilla global reutilizable entre proyectos. El `tipo`
    de un WorkItem viene de aquí (no de un enum fijo), lo que da niveles con
    nombres arbitrarios sin código por nivel.
    """

    __tablename__ = "tipos_nodo"

    proyecto_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    icono: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # JSON opcional con las reglas de anidación, p. ej.
    # {"tipos_hijos_permitidos": ["<tipo_id>", ...]}. Si es null, todo vale.
    reglas_anidacion: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Marca este tipo como "dependencia de terceros": un WorkItem de este tipo,
    # al colgarse de un padre, se pone delante de sus hermanos previos —que
    # pasan a colgar de él y a depender de él (FtS)— y actúa como puerta: el
    # trabajo del proyecto espera a su fecha de entrega, que fija alguien de
    # fuera. Es una PROPIEDAD del tipo (no de su nombre), así el tipo se puede
    # renombrar sin perder el comportamiento.
    es_dependencia_externa: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    __table_args__ = (
        # Uniqueness solo entre tipos VIVOS: un tipo borrado (soft delete) deja
        # su fila, y sin este `where` volver a crear un tipo con ese nombre
        # chocaba con la constraint → IntegrityError 500 (y el pre-check, que sí
        # ignora los borrados, no lo veía venir).
        Index(
            "uq_tipo_nodo_proyecto_nombre",
            "proyecto_id",
            "nombre",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )


class WorkItem(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    """Nodo de trabajo recursivo (patrón Composite).

    Toda la estructura del proyecto (etapa, programa, curso, módulo, fase,
    componente, actividad…) es del mismo tipo: lo que cambia es `tipo_id`. La
    autorreferencia `parent_id` da profundidad arbitraria.
    """

    __tablename__ = "work_items"

    proyecto_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("work_items.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    tipo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tipos_nodo.id"), nullable=False
    )
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    prioridad: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Fechas planeadas (el motor de derivación llega en el slice 2).
    fecha_inicio_plan: Mapped[Optional[datetime.date]] = mapped_column(
        Date, nullable=True
    )
    fecha_fin_plan: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)
    duracion_valor: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    duracion_unidad: Mapped[Optional[DuracionUnidad]] = mapped_column(
        Enum(
            DuracionUnidad,
            name="duracion_unidad",
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=True,
    )

    # Fechas reales y avance (capturado en hojas; en padres sube por rollup).
    fecha_inicio_real: Mapped[Optional[datetime.date]] = mapped_column(
        Date, nullable=True
    )
    fecha_fin_real: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)
    porcentaje_completado: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(5, 4), nullable=True
    )

    es_transversal: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    tipo: Mapped["TipoNodo"] = relationship("TipoNodo", lazy="raise")


class WorkItemDependency(Base, UUIDMixin, TimestampMixin):
    """Dependencia Finish-to-Start entre dos nodos de trabajo.

    `work_item` (sucesor) no puede iniciar hasta que `depends_on` (predecesor)
    termine. Equivalente a `task_dependencies`, pero sobre el árbol recursivo.
    """

    __tablename__ = "work_item_dependencies"

    work_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("work_items.id", ondelete="CASCADE"),
        nullable=False,
    )
    depends_on_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("work_items.id", ondelete="CASCADE"),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "work_item_id", "depends_on_id", name="uq_work_item_dependency"
        ),
    )
