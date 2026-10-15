from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.files.infrastructure.models import ProjectFile
from app.modules.tasks.infrastructure.models import TaskProgressUpdate
from app.modules.teams.infrastructure.workspace_models import (
    Deliverable,
    DeliverableVersion,
)


class TaskProgressRepository:
    """Persistencia de las ediciones de avance y de la evidencia que las apoya.

    Vive aparte de `TaskRepository` (que ya es el más grande del módulo) porque
    toca tablas de otros módulos —archivos y entregables— y esa frontera se lee
    mejor en un solo sitio.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ── ediciones ────────────────────────────────────────────────────────────

    async def add_update(self, update: TaskProgressUpdate) -> TaskProgressUpdate:
        self._session.add(update)
        await self._session.flush()
        return update

    async def list_updates(self, task_id: UUID) -> list[TaskProgressUpdate]:
        """Las ediciones de una tarea, de la más reciente a la más antigua."""
        query = (
            select(TaskProgressUpdate)
            .where(TaskProgressUpdate.task_id == task_id)
            .options(selectinload(TaskProgressUpdate.author))
            .order_by(TaskProgressUpdate.created_at.desc())
        )
        return list((await self._session.execute(query)).scalars().all())

    # ── evidencia ────────────────────────────────────────────────────────────

    async def get_file(self, file_id: UUID) -> ProjectFile | None:
        file = await self._session.get(ProjectFile, file_id)
        return None if file is None or file.is_deleted else file

    async def files_by_ids(self, file_ids: list[UUID]) -> dict[UUID, ProjectFile]:
        if not file_ids:
            return {}
        rows = await self._session.execute(
            select(ProjectFile).where(ProjectFile.id.in_(file_ids))
        )
        return {f.id: f for f in rows.scalars().all()}

    async def files_of_task(self, task_id: UUID) -> list[ProjectFile]:
        """Archivos vinculados a la tarea (entregas y evidencias), recientes primero."""
        rows = await self._session.execute(
            select(ProjectFile)
            .where(ProjectFile.task_id == task_id, ProjectFile.deleted_at.is_(None))
            .order_by(ProjectFile.created_at.desc())
        )
        return list(rows.scalars().all())

    async def get_deliverable_by_task(self, task_id: UUID) -> Deliverable | None:
        rows = await self._session.execute(
            select(Deliverable)
            .where(Deliverable.task_id == task_id, Deliverable.deleted_at.is_(None))
            .options(selectinload(Deliverable.versions))
        )
        return rows.scalars().first()

    async def get_version(self, version_id: UUID) -> DeliverableVersion | None:
        return await self._session.get(DeliverableVersion, version_id)

    async def versions_by_ids(
        self, version_ids: list[UUID]
    ) -> dict[UUID, DeliverableVersion]:
        if not version_ids:
            return {}
        rows = await self._session.execute(
            select(DeliverableVersion).where(DeliverableVersion.id.in_(version_ids))
        )
        return {v.id: v for v in rows.scalars().all()}

    async def add_version(self, version: DeliverableVersion) -> DeliverableVersion:
        self._session.add(version)
        await self._session.flush()
        return version

    async def deliverable_titles(self, deliverable_ids: list[UUID]) -> dict[UUID, str]:
        if not deliverable_ids:
            return {}
        rows = await self._session.execute(
            select(Deliverable.id, Deliverable.task_title).where(
                Deliverable.id.in_(deliverable_ids)
            )
        )
        return {did: title for did, title in rows.all()}
