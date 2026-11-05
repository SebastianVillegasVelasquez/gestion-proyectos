from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.project.incidents.infrastructure.models import (
    IncidentAttachment,
    ProjectIncident,
)


class IncidentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    @staticmethod
    def _with_relations():
        return select(ProjectIncident).options(
            selectinload(ProjectIncident.author),
            selectinload(ProjectIncident.attachments),
        )

    async def list_by_project(self, project_id: UUID) -> list[ProjectIncident]:
        query = (
            self._with_relations()
            .where(
                ProjectIncident.project_id == project_id,
                ProjectIncident.deleted_at.is_(None),
            )
            .order_by(
                ProjectIncident.incident_date.desc(),
                ProjectIncident.created_at.desc(),
            )
        )
        return list((await self._session.execute(query)).scalars().all())

    async def get(
        self, project_id: UUID, incident_id: UUID
    ) -> Optional[ProjectIncident]:
        query = self._with_relations().where(
            ProjectIncident.id == incident_id,
            ProjectIncident.project_id == project_id,
            ProjectIncident.deleted_at.is_(None),
        )
        return (await self._session.execute(query)).scalars().first()

    async def get_attachment(
        self, incident_id: UUID, attachment_id: UUID
    ) -> Optional[IncidentAttachment]:
        query = select(IncidentAttachment).where(
            IncidentAttachment.id == attachment_id,
            IncidentAttachment.incident_id == incident_id,
            IncidentAttachment.deleted_at.is_(None),
        )
        return (await self._session.execute(query)).scalars().first()

    async def add(self, incident: ProjectIncident) -> ProjectIncident:
        self._session.add(incident)
        await self._session.flush()
        return incident

    async def add_attachment(
        self, attachment: IncidentAttachment
    ) -> IncidentAttachment:
        self._session.add(attachment)
        await self._session.flush()
        await self._session.refresh(attachment)
        return attachment

    async def save(self) -> None:
        await self._session.flush()

    async def reload(self, project_id: UUID, incident_id: UUID) -> ProjectIncident:
        """Relee el incidente con sus relaciones frescas (tras crear o editar)."""
        self._session.expire_all()
        incident = await self.get(project_id, incident_id)
        if incident is None:
            raise LookupError("El incidente desapareció durante la operación")
        return incident
