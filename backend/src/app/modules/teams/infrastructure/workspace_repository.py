from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.tasks.infrastructure.enums import HistoryAction, TaskStatus
from app.modules.tasks.infrastructure.models import Task, TaskHistory
from app.modules.teams.domain.workspace import WorkspaceRepository
from app.modules.teams.infrastructure.enums import TeamRole
from app.modules.teams.infrastructure.models import Team, TeamMember
from app.modules.teams.infrastructure.workspace_models import (
    Deliverable,
    DeliverableComment,
    DeliverableVersion,
    TeamNotificationSetting,
)


class SqlAlchemyWorkspaceRepository(WorkspaceRepository):
    """Implementación SQLAlchemy del contrato WorkspaceRepository."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _persist(self, entity):
        self._session.add(entity)
        await self._session.flush()
        await self._session.refresh(entity)
        return entity

    async def get_member_role(self, team_id: UUID, user_id: UUID) -> TeamRole | None:
        return await self._session.scalar(
            select(TeamMember.team_role).where(
                TeamMember.team_id == team_id, TeamMember.user_id == user_id
            )
        )

    async def list_member_teams(self, user_id: UUID) -> list[Team]:
        rows = await self._session.execute(
            select(Team)
            .join(TeamMember, TeamMember.team_id == Team.id)
            .where(TeamMember.user_id == user_id, Team.deleted_at.is_(None))
            .order_by(Team.name)
        )
        return list(rows.scalars().all())

    async def list_members(self, team_id: UUID) -> list[TeamMember]:
        rows = await self._session.execute(
            select(TeamMember)
            .where(TeamMember.team_id == team_id)
            .options(selectinload(TeamMember.user))
            .order_by(TeamMember.created_at)
        )
        return list(rows.scalars().all())

    async def get_team(self, team_id: UUID) -> Team | None:
        return await self._session.get(Team, team_id)

    def _with_children(self):
        return select(Deliverable).options(
            selectinload(Deliverable.versions),
            selectinload(Deliverable.comments),
        )

    async def list_deliverables(self, team_id: UUID) -> list[Deliverable]:
        rows = await self._session.execute(
            self._with_children()
            .where(Deliverable.team_id == team_id, Deliverable.deleted_at.is_(None))
            .order_by(Deliverable.created_at.desc())
        )
        return list(rows.scalars().all())

    async def get_deliverable(
        self, team_id: UUID, deliverable_id: UUID
    ) -> Deliverable | None:
        return await self._session.scalar(
            self._with_children().where(
                Deliverable.id == deliverable_id,
                Deliverable.team_id == team_id,
                Deliverable.deleted_at.is_(None),
            )
        )

    async def add_deliverable(self, deliverable: Deliverable) -> Deliverable:
        return await self._persist(deliverable)

    async def save_deliverable(self, deliverable: Deliverable) -> Deliverable:
        return await self._persist(deliverable)

    async def add_version(self, version: DeliverableVersion) -> DeliverableVersion:
        return await self._persist(version)

    async def add_comment(self, comment: DeliverableComment) -> DeliverableComment:
        return await self._persist(comment)

    # ── Preferencias de aviso ────────────────────────────────────────────────
    async def get_notification_setting(
        self, team_id: UUID, user_id: UUID
    ) -> TeamNotificationSetting | None:
        return await self._session.scalar(
            select(TeamNotificationSetting).where(
                TeamNotificationSetting.team_id == team_id,
                TeamNotificationSetting.user_id == user_id,
            )
        )

    async def save_notification_setting(
        self, setting: TeamNotificationSetting
    ) -> TeamNotificationSetting:
        return await self._persist(setting)

    # ── Puerto hacia Task (Fase 2) ───────────────────────────────────────────
    async def get_task(self, task_id: UUID) -> Task | None:
        return await self._session.scalar(
            select(Task).where(Task.id == task_id, Task.deleted_at.is_(None))
        )

    async def transition_task(
        self,
        task: Task,
        new_status: TaskStatus,
        actor_id: UUID,
        change_reason: str | None = None,
    ) -> Task:
        # Idempotente: si ya está en el estado destino, no reescribe historial.
        if task.status == new_status:
            return task

        old_status = task.status
        task.status = new_status
        # `completed_at` refleja el momento real de completar (queda vacío si
        # la tarea se reabre a otro estado más tarde).
        if new_status == TaskStatus.COMPLETADA:
            task.completed_at = datetime.now(timezone.utc)
        elif old_status == TaskStatus.COMPLETADA:
            task.completed_at = None

        self._session.add(
            TaskHistory(
                task_id=task.id,
                changed_by_id=actor_id,
                action=HistoryAction.CAMBIO_ESTADO,
                old_status=old_status,
                new_status=new_status,
                change_reason=change_reason,
            )
        )
        await self._session.flush()
        return task
