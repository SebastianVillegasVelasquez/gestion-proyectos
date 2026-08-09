from typing import Iterable, Optional
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.orm import selectinload

from app.modules.project.infrastructure.models import (
    Project,
    ProjectMember,
    ProjectNote,
)
from app.modules.project.structure.infrastructure.models import WorkItem
from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.tasks.infrastructure.models import Task
from app.shared.base_repository import BaseRepository


class ProjectRepository(BaseRepository[Project]):
    def __init__(self, session):
        super().__init__(session=session, model=Project)

    async def get_progress_map(self, project_ids: Iterable[UUID]) -> dict[UUID, float]:
        """Devuelve {project_id: progress_pct} contando tareas por proyecto.

        Progreso = tareas COMPLETADA / tareas totales * 100 (0.0 si no hay tareas).
        Se hace en una sola query para no caer en N+1 al listar proyectos.
        Es la misma fórmula que usa el dashboard, así el número es consistente.
        """
        ids = list(project_ids)
        if not ids:
            return {}

        completed_case = case((Task.status == TaskStatus.COMPLETADA, 1), else_=0)
        query = (
            select(
                WorkItem.proyecto_id.label("pid"),
                func.count(Task.id).label("total"),
                func.coalesce(func.sum(completed_case), 0).label("completed"),
            )
            .select_from(Task)
            .join(WorkItem, Task.work_item_id == WorkItem.id)
            .where(Task.deleted_at.is_(None), WorkItem.proyecto_id.in_(ids))
            .group_by(WorkItem.proyecto_id)
        )
        rows = (await self._session.execute(query)).all()

        result: dict[UUID, float] = {pid: 0.0 for pid in ids}
        for pid, total, completed in rows:
            if total:
                result[pid] = round(float(completed) / float(total) * 100, 1)
        return result

    # ── Notas del proyecto ───────────────────────────────────────────────────
    async def add_note(self, note: ProjectNote) -> ProjectNote:
        self._session.add(note)
        await self._session.flush()
        await self._session.refresh(note)
        return note

    async def get_notes_by_project(self, project_id: UUID) -> list[tuple]:
        """Notas vivas del proyecto con el nombre del autor ya resuelto.

        LEFT JOIN al usuario porque el autor es opcional (pudo eliminarse). Se
        ordenan de la más reciente a la más antigua por fecha de la nota.
        """
        from app.modules.identity.infrastructure.models import User

        query = (
            select(
                ProjectNote,
                func.concat(User.name, " ", User.last_name).label("author_name"),
            )
            .outerjoin(User, ProjectNote.author_id == User.id)
            .where(
                ProjectNote.project_id == project_id,
                ProjectNote.deleted_at.is_(None),
            )
            .order_by(ProjectNote.note_date.desc(), ProjectNote.created_at.desc())
        )
        return [tuple(r) for r in (await self._session.execute(query)).all()]

    async def get_note_by_id(self, note_id: UUID) -> Optional[ProjectNote]:
        return await self._session.get(ProjectNote, note_id)

    async def save_note(self, note: ProjectNote) -> ProjectNote:
        self._session.add(note)
        await self._session.flush()
        return note


class ProjectMemberRepository(BaseRepository[ProjectMember]):
    def __init__(self, session):
        super().__init__(session=session, model=ProjectMember)

    async def get_all_members_by_project_id(
        self, project_id: UUID
    ) -> list[ProjectMember]:
        query = (
            select(ProjectMember)
            .where(
                ProjectMember.project_id == project_id,
                ProjectMember.deleted_at.is_(None),
            )
            .options(selectinload(ProjectMember.user))
        )
        result = await self._session.execute(query)
        return list(result.scalars().all())

    async def get_member_by_project_id_and_user_id(
        self, project_id: UUID, user_id: UUID
    ) -> Optional[ProjectMember]:
        query = select(ProjectMember).where(
            ProjectMember.project_id == project_id, ProjectMember.user_id == user_id
        )
        result = await self._session.execute(query)
        return result.scalars().first()

    async def get_member_by_id(self, member_id: UUID) -> Optional[ProjectMember]:
        query = (
            select(ProjectMember)
            .where(ProjectMember.id == member_id)
            .options(selectinload(ProjectMember.user))
        )
        result = await self._session.execute(query)
        return result.scalars().first()
