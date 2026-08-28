from typing import Iterable, Optional
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.orm import selectinload

from app.modules.project.domain.member_progress import (
    MemberProgress,
    WorkNode,
    WorkTask,
    aggregate_progress_by_user,
    compute_task_weights,
)
from app.modules.project.infrastructure.models import (
    Project,
    ProjectMember,
    ProjectNote,
)
from app.modules.project.structure.infrastructure.models import WorkItem
from app.modules.tasks.infrastructure.enums import TaskStatus
from app.modules.tasks.infrastructure.models import Task
from app.modules.teams.infrastructure.models import Team, TeamMember
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

    async def get_member_progress(self, project_id: UUID) -> dict[UUID, MemberProgress]:
        """Avance ponderado por integrante (para decidir cuándo pagarle).

        Ver `app.modules.project.domain.member_progress` para la regla de
        reparto por profundidad del árbol. Tres queries (nodos, tareas,
        integrantes de los equipos involucrados) y el resto es cómputo en
        memoria: nada de esto escala mal a los tamaños de un proyecto real.
        """
        node_rows = (
            await self._session.execute(
                select(WorkItem.id, WorkItem.parent_id).where(
                    WorkItem.proyecto_id == project_id,
                    WorkItem.deleted_at.is_(None),
                )
            )
        ).all()
        nodes = [WorkNode(id=r.id, parent_id=r.parent_id) for r in node_rows]

        task_rows = (
            await self._session.execute(
                select(
                    Task.id,
                    Task.work_item_id,
                    Task.assignee_id,
                    Task.team_id,
                    Task.status,
                ).where(Task.project_id == project_id, Task.deleted_at.is_(None))
            )
        ).all()
        tasks = [
            WorkTask(
                id=r.id,
                work_item_id=r.work_item_id,
                assignee_id=r.assignee_id,
                team_id=r.team_id,
                is_completed=r.status == TaskStatus.COMPLETADA,
            )
            for r in task_rows
        ]

        team_ids = {t.team_id for t in tasks if t.team_id is not None}
        team_member_ids: dict[UUID, list[UUID]] = {}
        if team_ids:
            member_rows = (
                await self._session.execute(
                    select(TeamMember.team_id, TeamMember.user_id).where(
                        TeamMember.team_id.in_(team_ids)
                    )
                )
            ).all()
            for r in member_rows:
                team_member_ids.setdefault(r.team_id, []).append(r.user_id)

        weights = compute_task_weights(nodes, tasks)
        return aggregate_progress_by_user(tasks, weights, team_member_ids)

    async def get_member_teams(
        self, project_id: UUID
    ) -> dict[UUID, list[tuple[UUID, str]]]:
        """{user_id: [(team_id, nombre) de equipos de ESTE proyecto]}.

        Una sola query (team_members ⋈ teams). Un integrante puede estar en
        varios equipos; se devuelven ordenados alfabéticamente por nombre para
        que la UI los pinte de forma estable.
        """
        rows = (
            await self._session.execute(
                select(TeamMember.user_id, Team.id, Team.name)
                .join(Team, Team.id == TeamMember.team_id)
                .where(
                    Team.project_id == project_id,
                    Team.deleted_at.is_(None),
                )
                .order_by(Team.name)
            )
        ).all()
        result: dict[UUID, list[tuple[UUID, str]]] = {}
        for user_id, team_id, name in rows:
            result.setdefault(user_id, []).append((team_id, name))
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
