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

    # ── Entregables personales (sin equipo) ─────────────────────────────────
    async def list_personal_deliverables(self, user_id: UUID) -> list[Deliverable]:
        rows = await self._session.execute(
            self._with_children()
            .where(
                Deliverable.team_id.is_(None),
                Deliverable.assignee_id == user_id,
                Deliverable.deleted_at.is_(None),
            )
            .order_by(Deliverable.created_at.desc())
        )
        return list(rows.scalars().all())

    async def get_personal_deliverable(
        self, deliverable_id: UUID
    ) -> Deliverable | None:
        return await self._session.scalar(
            self._with_children().where(
                Deliverable.id == deliverable_id,
                Deliverable.team_id.is_(None),
                Deliverable.deleted_at.is_(None),
            )
        )

    async def list_personal_review_queue(
        self, reviewer_id: UUID, statuses: list[TaskStatus]
    ) -> list[tuple[Deliverable, UUID, str]]:
        from app.modules.project.infrastructure.enums import ProjectRole
        from app.modules.project.infrastructure.models import Project, ProjectMember

        reviewable = (
            select(ProjectMember.project_id)
            .where(
                ProjectMember.user_id == reviewer_id,
                ProjectMember.deleted_at.is_(None),
                ProjectMember.project_role.in_(
                    [ProjectRole.COORDINADOR, ProjectRole.SUPERVISOR]
                ),
            )
            .scalar_subquery()
        )
        rows = await self._session.execute(
            self._with_children()
            .add_columns(Project.id, Project.name)
            .join(Task, Task.id == Deliverable.task_id)
            .join(Project, Project.id == Task.project_id)
            .where(
                Deliverable.team_id.is_(None),
                Deliverable.deleted_at.is_(None),
                Task.deleted_at.is_(None),
                Task.status.in_(statuses),
                Task.project_id.in_(reviewable),
            )
            .order_by(Deliverable.created_at.desc())
        )
        return [(d, pid, pname) for d, pid, pname in rows.all()]

    async def get_project_review_role(
        self, project_id: UUID, user_id: UUID
    ) -> str | None:
        from app.modules.project.infrastructure.models import ProjectMember

        role = await self._session.scalar(
            select(ProjectMember.project_role).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user_id,
                ProjectMember.deleted_at.is_(None),
            )
        )
        return role.value if role is not None else None

    async def get_project_name(self, project_id: UUID) -> str | None:
        from app.modules.project.infrastructure.models import Project

        return await self._session.scalar(
            select(Project.name).where(Project.id == project_id)
        )

    async def get_deliverable_by_task(self, task_id: UUID) -> Deliverable | None:
        return await self._session.scalar(
            self._with_children().where(
                Deliverable.task_id == task_id, Deliverable.deleted_at.is_(None)
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

    async def save_task(self, task: Task) -> Task:
        return await self._persist(task)

    async def task_delivery_block_reason(self, task: Task) -> str | None:
        # Reusa la misma regla FtS del módulo de tareas: una dependencia que no
        # está COMPLETADA / un elemento del árbol no entregado, o una actividad
        # de terceros ancestro sin fecha real. `TaskRepository` comparte sesión.
        from app.modules.tasks.domain import rules
        from app.modules.tasks.infrastructure.repository import TaskRepository

        task_repo = TaskRepository(self._session)
        deps = await task_repo.get_dependencies(task.id)
        if rules.incomplete_dependency_ids(deps):
            return (
                "No puedes entregar: una tarea o actividad de la que depende "
                "aún no está completada."
            )
        if task.work_item_id is not None and (
            await task_repo.has_undelivered_third_party_ancestor(task.work_item_id)
        ):
            return (
                "No puedes entregar: la actividad de terceros de la que depende "
                "este trabajo aún no fue entregada."
            )
        return None

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
