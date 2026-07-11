import uuid
from dataclasses import dataclass
from datetime import datetime

from app.modules.project.infrastructure.enums import ProjectRole


@dataclass(frozen=True)
class DomainEvent:
    """Marcador base de todos los eventos de dominio.

    Reglas:
      * Inmutable (`frozen=True`): el pasado no se reescribe.
      * Solo datos primitivos / ids: nada de instancias del ORM. Así un evento
        sobrevive si el día de mañana lo serializamos a JSON para mandarlo por
        la red (RabbitMQ, Redis pub/sub, etc.).
      * Nombre en pasado en las subclases: `MemberAssigned`, no `AssignMember`.
    """

    occurred_at: datetime


@dataclass(frozen=True)
class TaskSubmitted(DomainEvent):
    work_item_id: uuid.UUID
    task_id: uuid.UUID
    assigned_id: uuid.UUID


@dataclass(frozen=True)
class TaskCreated(DomainEvent):
    work_item_id: uuid.UUID
    task_id: uuid.UUID
    assigned_id: uuid.UUID


@dataclass(frozen=True)
class MemberAssigned(DomainEvent):
    """Un usuario fue agregado como miembro de un proyecto."""

    project_id: uuid.UUID
    user_id: uuid.UUID
    project_role: ProjectRole
    # Quien realizó la asignación. Nullable si la origina el sistema (seed, import, etc.).
    assigned_by: uuid.UUID | None
