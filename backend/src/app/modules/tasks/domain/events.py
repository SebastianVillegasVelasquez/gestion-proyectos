import uuid
from dataclasses import dataclass

from app.shared.events import DomainEvent


@dataclass(frozen=True)
class TaskSubmitted(DomainEvent):
    project_id: uuid.UUID
    task_id: uuid.UUID
    assigned_id: uuid.UUID
