from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.files.infrastructure.models import ProjectFile, ProjectFolder
from app.modules.project.infrastructure.enums import ProjectRole
from app.modules.project.infrastructure.models import ProjectMember
from app.modules.teams.infrastructure.enums import TeamRole
from app.modules.teams.infrastructure.models import Team, TeamMember
from app.modules.teams.infrastructure.workspace_models import (
    Deliverable,
    DeliverableVersion,
)


class ProjectFilesRepository:
    """Persistencia del archivador. Todo va acotado por `project_id`: un
    archivo de un proyecto nunca se alcanza desde otro."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ── autorización ─────────────────────────────────────────────────────────

    async def is_project_member(self, project_id: UUID, user_id: UUID) -> bool:
        # `scalar` de un COUNT nunca devuelve None en la práctica, pero su tipo
        # lo admite: `or 0` deja la comparación bien tipada sin un cast.
        return (
            await self._session.scalar(
                select(func.count())
                .select_from(ProjectMember)
                .where(
                    ProjectMember.project_id == project_id,
                    ProjectMember.user_id == user_id,
                    ProjectMember.deleted_at.is_(None),
                )
            )
            or 0
        ) > 0

    async def project_role(self, project_id: UUID, user_id: UUID) -> ProjectRole | None:
        """Rol del usuario DENTRO del proyecto (coordinador, supervisor…).

        Es lo que separa a quien mira el proyecto entero de quien solo mira su
        equipo, así que se pregunta aparte de la simple pertenencia.
        """
        return await self._session.scalar(
            select(ProjectMember.project_role).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user_id,
                ProjectMember.deleted_at.is_(None),
            )
        )

    async def team_roles_in_project(
        self, project_id: UUID, user_id: UUID
    ) -> dict[UUID, TeamRole]:
        """Equipos VIVOS del proyecto a los que pertenece el usuario, con su rol."""
        rows = await self._session.execute(
            select(TeamMember.team_id, TeamMember.team_role)
            .join(Team, Team.id == TeamMember.team_id)
            .where(
                Team.project_id == project_id,
                Team.deleted_at.is_(None),
                TeamMember.user_id == user_id,
            )
        )
        return {team_id: role for team_id, role in rows.all()}

    async def list_project_teams(self, project_id: UUID) -> list[Team]:
        rows = await self._session.execute(
            select(Team)
            .where(Team.project_id == project_id, Team.deleted_at.is_(None))
            .order_by(Team.name)
        )
        return list(rows.scalars().all())

    # ── carpetas ─────────────────────────────────────────────────────────────

    async def get_root(self, project_id: UUID) -> ProjectFolder | None:
        return await self._session.scalar(
            select(ProjectFolder).where(
                ProjectFolder.project_id == project_id,
                ProjectFolder.parent_id.is_(None),
                ProjectFolder.deleted_at.is_(None),
            )
        )

    async def get_folder(
        self, project_id: UUID, folder_id: UUID
    ) -> ProjectFolder | None:
        return await self._session.scalar(
            select(ProjectFolder).where(
                ProjectFolder.id == folder_id,
                ProjectFolder.project_id == project_id,
                ProjectFolder.deleted_at.is_(None),
            )
        )

    async def list_folders(self, project_id: UUID) -> list[ProjectFolder]:
        rows = await self._session.execute(
            select(ProjectFolder)
            .where(
                ProjectFolder.project_id == project_id,
                ProjectFolder.deleted_at.is_(None),
            )
            .order_by(ProjectFolder.name)
        )
        return list(rows.scalars().all())

    async def sibling_exists(self, parent_id: UUID, name: str) -> bool:
        """¿Ya hay una carpeta viva con ese nombre bajo el mismo padre?"""
        return (
            await self._session.scalar(
                select(func.count())
                .select_from(ProjectFolder)
                .where(
                    ProjectFolder.parent_id == parent_id,
                    func.lower(ProjectFolder.name) == name.lower(),
                    ProjectFolder.deleted_at.is_(None),
                )
            )
            or 0
        ) > 0

    async def add_folder(self, folder: ProjectFolder) -> ProjectFolder:
        self._session.add(folder)
        await self._session.flush()
        await self._session.refresh(folder)
        return folder

    # ── archivos ─────────────────────────────────────────────────────────────

    async def list_files(self, project_id: UUID) -> list[ProjectFile]:
        rows = await self._session.execute(
            select(ProjectFile)
            # Con el autor cargado de una vez: la vista muestra "quién lo subió"
            # en cada fila y sin esto sería una consulta por archivo.
            .options(selectinload(ProjectFile.author))
            .where(
                ProjectFile.project_id == project_id,
                ProjectFile.deleted_at.is_(None),
            )
            .order_by(ProjectFile.name)
        )
        return list(rows.scalars().all())

    async def get_file(self, project_id: UUID, file_id: UUID) -> ProjectFile | None:
        return await self._session.scalar(
            select(ProjectFile).where(
                ProjectFile.id == file_id,
                ProjectFile.project_id == project_id,
                ProjectFile.deleted_at.is_(None),
            )
        )

    async def file_name_taken(self, folder_id: UUID, name: str) -> bool:
        return (
            await self._session.scalar(
                select(func.count())
                .select_from(ProjectFile)
                .where(
                    ProjectFile.folder_id == folder_id,
                    func.lower(ProjectFile.name) == name.lower(),
                    ProjectFile.deleted_at.is_(None),
                )
            )
            or 0
        ) > 0

    async def deliveries_by_file(self, project_id: UUID) -> dict[UUID, tuple]:
        """De qué ENTREGA salió cada archivo: `file_id → (versión, entregable)`.

        Un archivo del archivador casi siempre llega por una entrega del
        workspace, y quien revisa necesita ver "esto es la V2 de «Guion módulo
        1»" sin salir del gestor de archivos. En una sola consulta para todo el
        proyecto: pedirlo archivo por archivo sería un N+1 sobre la vista que
        más filas pinta.
        """
        rows = await self._session.execute(
            select(DeliverableVersion, Deliverable)
            .join(Deliverable, Deliverable.id == DeliverableVersion.deliverable_id)
            .join(ProjectFile, ProjectFile.id == DeliverableVersion.file_id)
            .where(
                ProjectFile.project_id == project_id,
                Deliverable.deleted_at.is_(None),
            )
        )
        return {
            version.file_id: (version, deliverable)
            for version, deliverable in rows.all()
        }

    async def add_file(self, file: ProjectFile) -> ProjectFile:
        self._session.add(file)
        await self._session.flush()
        await self._session.refresh(file)
        return file

    async def save(self) -> None:
        await self._session.flush()
