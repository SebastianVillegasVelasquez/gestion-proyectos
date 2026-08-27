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
class TaskCommented(DomainEvent):
    """Alguien comentó una tarea, quizá mencionando a otras personas.

    Lleva los ids de los mencionados para que el manejador de notificaciones
    no tenga que volver a la base de datos ni interpretar el texto.
    """

    task_id: uuid.UUID
    comment_id: uuid.UUID
    author_id: uuid.UUID
    # Responsable de la tarea, si lo hay: se entera de que le comentaron.
    assignee_id: uuid.UUID | None
    mentioned_user_ids: tuple[uuid.UUID, ...] = ()


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
