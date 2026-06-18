from dataclasses import dataclass
from datetime import datetime


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
