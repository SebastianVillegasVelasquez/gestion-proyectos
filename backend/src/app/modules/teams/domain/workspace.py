from abc import ABC, abstractmethod
from dataclasses import dataclass
from uuid import UUID

from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.tasks.infrastructure.models import Task
from app.modules.teams.infrastructure.enums import TeamRole
from app.modules.teams.infrastructure.models import Team, TeamMember
from app.modules.teams.infrastructure.workspace_models import (
    Deliverable,
    DeliverableComment,
    DeliverableVersion,
    TeamNotificationSetting,
)

_ADMIN_SYSTEM_ROLES = {"admin", "super_admin"}
_REVIEW_TEAM_ROLES = {TeamRole.LIDER, TeamRole.SUPERVISOR}


@dataclass(frozen=True)
class WorkspaceAccess:
    """Política de acceso al espacio de trabajo de un equipo (lógica pura).

    Única fuente de verdad de la autorización. Privacidad del equipo + visión del
    admin se expresan aquí; las rutas y use cases solo la consultan (SRP). Para
    extender reglas en el futuro se agregan propiedades, sin tocar el resto (OCP).
    """

    is_admin: bool
    team_role: TeamRole | None

    @classmethod
    def resolve(cls, system_role: str, team_role: TeamRole | None) -> "WorkspaceAccess":
        return cls(is_admin=system_role in _ADMIN_SYSTEM_ROLES, team_role=team_role)

    @property
    def is_member(self) -> bool:
        return self.team_role is not None

    @property
    def can_view(self) -> bool:
        """El admin observa cualquier equipo; el resto solo si es integrante."""
        return self.is_admin or self.is_member

    @property
    def can_deliver(self) -> bool:
        """Solo los integrantes del equipo entregan; el admin solo observa."""
        return self.is_member

    @property
    def can_comment(self) -> bool:
        return self.is_member

    @property
    def can_review(self) -> bool:
        """Solicitar cambios / aprobar: solo líder o supervisor del equipo."""
        return self.team_role in _REVIEW_TEAM_ROLES


class WorkspaceRepository(ABC):
    """Contrato de persistencia del espacio de trabajo (Dependency Inversion).

    Todo está acotado por `team_id`: la información de un equipo se queda en él.
    """

    @abstractmethod
    async def get_member_role(
        self, team_id: UUID, user_id: UUID
    ) -> TeamRole | None: ...

    @abstractmethod
    async def list_member_teams(self, user_id: UUID) -> list[Team]: ...

    @abstractmethod
    async def list_members(self, team_id: UUID) -> list[TeamMember]: ...

    @abstractmethod
    async def get_team(self, team_id: UUID) -> Team | None: ...

    @abstractmethod
    async def list_deliverables(self, team_id: UUID) -> list[Deliverable]: ...

    @abstractmethod
    async def get_deliverable(
        self, team_id: UUID, deliverable_id: UUID
    ) -> Deliverable | None: ...

    # ── Entregables personales (sin equipo) ─────────────────────────────────
    # Mismo modelo `Deliverable` con `team_id IS NULL`; el dueño es
    # `assignee_id`. La autorización vive en el caso de uso personal, no aquí.

    @abstractmethod
    async def list_personal_deliverables(self, user_id: UUID) -> list[Deliverable]: ...

    @abstractmethod
    async def get_personal_deliverable(
        self, deliverable_id: UUID
    ) -> Deliverable | None: ...

    @abstractmethod
    async def list_personal_review_queue(
        self, reviewer_id: UUID, statuses: list[TaskStatus]
    ) -> list[tuple[Deliverable, UUID, str]]:
        """Entregables personales cuya tarea vive en un proyecto que
        `reviewer_id` coordina o supervisa, en alguno de los `statuses` de
        tarea dados. Devuelve (deliverable, project_id, project_name)."""
        ...

    @abstractmethod
    async def get_project_review_role(
        self, project_id: UUID, user_id: UUID
    ) -> str | None:
        """`project_role` del usuario en el proyecto (o None si no es miembro)."""
        ...

    @abstractmethod
    async def get_project_name(self, project_id: UUID) -> str | None: ...

    @abstractmethod
    async def get_deliverable_by_task(self, task_id: UUID) -> Deliverable | None:
        """El entregable vivo (si existe) ya enganchado a esta Task.

        Deja crear "solo un entregable por tarea asignada" con un mensaje
        claro, en vez de que la persona se entere por un 500 del índice único
        de la base de datos.
        """
        ...

    @abstractmethod
    async def add_deliverable(self, deliverable: Deliverable) -> Deliverable: ...

    @abstractmethod
    async def save_deliverable(self, deliverable: Deliverable) -> Deliverable: ...

    @abstractmethod
    async def add_version(self, version: DeliverableVersion) -> DeliverableVersion: ...

    @abstractmethod
    async def add_comment(self, comment: DeliverableComment) -> DeliverableComment: ...

    # ── Preferencias de aviso (por equipo y usuario) ─────────────────────────

    @abstractmethod
    async def get_notification_setting(
        self, team_id: UUID, user_id: UUID
    ) -> TeamNotificationSetting | None: ...

    @abstractmethod
    async def save_notification_setting(
        self, setting: TeamNotificationSetting
    ) -> TeamNotificationSetting: ...

    # ── Puerto hacia el mundo Task (Fase 2) ──────────────────────────────────
    # No expone la API de tareas: solo las 3 operaciones que el workspace
    # necesita para engancharse a la trazabilidad (SRP), y en la misma
    # transacción (consistencia entre entregable y estado de la tarea).

    @abstractmethod
    async def get_task(self, task_id: UUID) -> Task | None: ...

    @abstractmethod
    async def save_task(self, task: Task) -> Task:
        """Persiste cambios sueltos de la tarea (p. ej. el toggle
        `requires_approval` desde la pantalla de entregas personales)."""
        ...

    @abstractmethod
    async def transition_task(
        self,
        task: Task,
        new_status: TaskStatus,
        actor_id: UUID,
        change_reason: str | None = None,
    ) -> Task:
        """Cambia el estado de la tarea Y escribe TaskHistory en un solo paso.

        Idempotente: si la tarea ya está en `new_status`, no re-escribe historial
        ni toca `completed_at`. Esto evita que reentregas o clics dobles inflen
        la trazabilidad.
        """

    @abstractmethod
    async def task_delivery_block_reason(self, task: Task) -> str | None:
        """Motivo por el que la tarea NO puede entregarse todavía —una
        dependencia finish-to-start sin completar, o una «actividad de
        terceros» ancestro que aún no fue entregada—; `None` si puede.

        Entregar mueve el estado de la tarea sin pasar por
        `ChangeTaskStatusUseCase`, así que la compuerta FtS hay que aplicarla
        también aquí; si no, se puede entregar trabajo que depende de algo que
        todavía no está listo.
        """
        ...
