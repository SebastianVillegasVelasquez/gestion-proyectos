import datetime as _dt
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
    # Proyecto de la tarea: permite construir el enlace "ver tarea" de la
    # notificación sin otra consulta. Opcional por compatibilidad hacia atrás.
    project_id: uuid.UUID | None = None


@dataclass(frozen=True)
class TaskCreated(DomainEvent):
    # None cuando la tarea se crea suelta, sin estructura todavía.
    work_item_id: uuid.UUID | None
    task_id: uuid.UUID
    assigned_id: uuid.UUID
    project_id: uuid.UUID | None = None
    # Equipo de la tarea, si está delegada a uno: deja que el manejador de
    # notificaciones respete las preferencias por-equipo del destinatario.
    team_id: uuid.UUID | None = None


@dataclass(frozen=True)
class TaskAssigned(DomainEvent):
    """Se (re)asignó una tarea a una persona concreta después de crearla.

    Cubre el hueco de `TaskCreated`: cambiar el responsable de una tarea ya
    existente (reasignación del líder, o alta de tarea de equipo que fija el
    responsable en un segundo paso) no disparaba ningún aviso.
    """

    task_id: uuid.UUID
    assignee_id: uuid.UUID
    assigned_by: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    team_id: uuid.UUID | None = None
    work_item_id: uuid.UUID | None = None


@dataclass(frozen=True)
class TaskCompleted(DomainEvent):
    """El líder aprobó la entrega y marcó la tarea como completada."""

    project_id: uuid.UUID
    task_id: uuid.UUID
    assigned_id: uuid.UUID
    team_id: uuid.UUID | None = None
    # Quién aprobó: para no notificarle su propia acción.
    actor_id: uuid.UUID | None = None


@dataclass(frozen=True)
class TaskStarted(DomainEvent):
    """El responsable marcó que empezó a trabajar la tarea (PENDIENTE → EN_PROGRESO).

    Sirve para avisar a quien coordina (líder/supervisor del equipo, o
    coordinación del proyecto si la tarea no está delegada a un equipo) de que
    el trabajo arrancó.
    """

    project_id: uuid.UUID
    task_id: uuid.UUID
    assigned_id: uuid.UUID
    team_id: uuid.UUID | None = None
    # Quién movió el estado: para no avisarle de su propia acción.
    actor_id: uuid.UUID | None = None


@dataclass(frozen=True)
class TaskReturned(DomainEvent):
    """El líder devolvió la entrega para que el responsable corrija."""

    project_id: uuid.UUID
    task_id: uuid.UUID
    assigned_id: uuid.UUID
    team_id: uuid.UUID | None = None


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
    project_id: uuid.UUID | None = None
    team_id: uuid.UUID | None = None


@dataclass(frozen=True)
class ThirdPartyDeliveryDateSet(DomainEvent):
    """Una "actividad de terceros" (elemento de un tipo con
    `es_dependencia_externa`) recibió o cambió su fecha de entrega.

    El trabajo del proyecto colgado de ella estaba a la espera; ahora sus
    tareas dependientes ya pueden planificarse. Lleva RESUELTOS los ids de los
    responsables a avisar y los de sus tareas, para que el manejador de
    notificaciones no toque la base de datos.
    """

    project_id: uuid.UUID
    work_item_id: uuid.UUID
    work_item_nombre: str
    delivery_date: _dt.date | None = None
    recipient_ids: tuple[uuid.UUID, ...] = ()
    task_ids: tuple[uuid.UUID, ...] = ()
    # Quién movió la fecha: para no avisarle de su propia acción.
    actor_id: uuid.UUID | None = None


@dataclass(frozen=True)
class UserCreated(DomainEvent):
    """Se creó una cuenta nueva (alta individual o carga masiva por CSV)."""

    user_id: uuid.UUID
    email: str
    name: str
    # Contraseña temporal generada por el sistema, solo cuando el alta no trajo
    # una definida. Viaja en el evento porque el correo de bienvenida la incluye
    # para que la persona pueda entrar. None si el admin definió la contraseña.
    temporary_password: str | None = None


@dataclass(frozen=True)
class MemberAssigned(DomainEvent):
    """Un usuario fue agregado como miembro de un proyecto."""

    project_id: uuid.UUID
    user_id: uuid.UUID
    project_role: ProjectRole
    # Quien realizó la asignación. Nullable si la origina el sistema (seed, import, etc.).
    assigned_by: uuid.UUID | None
