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
    # None cuando la tarea se crea suelta, sin estructura todavía.
    work_item_id: uuid.UUID | None
    task_id: uuid.UUID
    assigned_id: uuid.UUID


@dataclass(frozen=True)
class TaskCompleted(DomainEvent):
    """El líder aprobó la entrega y marcó la tarea como completada."""

    project_id: uuid.UUID
    task_id: uuid.UUID
    assigned_id: uuid.UUID


@dataclass(frozen=True)
class TaskReturned(DomainEvent):
    """El líder devolvió la entrega para que el responsable corrija."""

    project_id: uuid.UUID
    task_id: uuid.UUID
    assigned_id: uuid.UUID


@dataclass(frozen=True)
class UserCreated(DomainEvent):
    """Se creó una cuenta nueva (alta individual o carga masiva por CSV)."""

    user_id: uuid.UUID
    email: str
    name: str


@dataclass(frozen=True)
class MemberAssigned(DomainEvent):
    """Un usuario fue agregado como miembro de un proyecto."""

    project_id: uuid.UUID
    user_id: uuid.UUID
    project_role: ProjectRole
    # Quien realizó la asignación. Nullable si la origina el sistema (seed, import, etc.).
    assigned_by: uuid.UUID | None
