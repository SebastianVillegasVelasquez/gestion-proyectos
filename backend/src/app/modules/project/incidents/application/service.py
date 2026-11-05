from datetime import datetime, timezone
from uuid import UUID

from app.modules.project.incidents.domain.schedule import shift_end_date
from app.modules.project.incidents.infrastructure.models import (
    IncidentAttachment,
    ProjectIncident,
)
from app.modules.project.incidents.infrastructure.repository import IncidentRepository
from app.modules.project.incidents.presentation.schemas import (
    CreateIncidentRequest,
    IncidentAttachmentResponse,
    IncidentResponse,
    UpdateIncidentRequest,
)
from app.modules.project.infrastructure.models import Project
from app.modules.project.infrastructure.repository import ProjectRepository
from app.shared.exceptions import ConflictError, NotFoundError, ValidationError
from app.shared.storage import FileStorage, sanitize_filename

# Campos que un PATCH puede vaciar enviando `null`; en el resto `null` se ignora.
_CLEARABLE_FIELDS = {"description", "email_body", "client_response_date"}


def to_response(incident: ProjectIncident) -> IncidentResponse:
    author = incident.author
    return IncidentResponse(
        id=incident.id,
        project_id=incident.project_id,
        title=incident.title,
        description=incident.description,
        email_body=incident.email_body,
        responsible=incident.responsible,
        incident_date=incident.incident_date,
        impact_days=incident.impact_days,
        client_response_date=incident.client_response_date,
        applied_days=incident.applied_days,
        applied_at=incident.applied_at,
        author_name=f"{author.name} {author.last_name}" if author else None,
        created_at=incident.created_at,
        attachments=[
            IncidentAttachmentResponse.model_validate(a) for a in incident.attachments
        ],
    )


class ProjectIncidentService:
    """Casos de uso de la bitácora de incidentes de un proyecto.

    Regla central: registrar un incidente NO mueve el cronograma. Solo
    `apply` suma los días a la fecha de fin del proyecto y `revert` los quita;
    `applied_days` es la "foto" de lo aplicado, así que revertir es exacto
    aunque los días del incidente se hubieran editado (cosa que además se
    bloquea mientras está aplicado).
    """

    def __init__(
        self,
        repo: IncidentRepository,
        project_repo: ProjectRepository,
        storage: FileStorage,
    ) -> None:
        self._repo = repo
        self._projects = project_repo
        self._storage = storage

    # ── Consulta ────────────────────────────────────────────────────────────
    async def list_incidents(self, project_id: UUID) -> list[IncidentResponse]:
        await self._active_project(project_id)
        return [to_response(i) for i in await self._repo.list_by_project(project_id)]

    # ── Alta / edición / baja ───────────────────────────────────────────────
    async def create(
        self, project_id: UUID, data: CreateIncidentRequest, author_id: UUID
    ) -> IncidentResponse:
        await self._active_project(project_id)
        incident = await self._repo.add(
            ProjectIncident(
                project_id=project_id,
                created_by=author_id,
                **data.model_dump(),
            )
        )
        return to_response(await self._repo.reload(project_id, incident.id))

    async def update(
        self, project_id: UUID, incident_id: UUID, data: UpdateIncidentRequest
    ) -> IncidentResponse:
        incident = await self._get(project_id, incident_id)
        changes = data.model_dump(exclude_unset=True)

        if incident.applied_days is not None and "impact_days" in changes:
            raise ConflictError(
                "Revierte el atraso del cronograma antes de cambiar los días"
            )

        for field, value in changes.items():
            if value is not None or field in _CLEARABLE_FIELDS:
                setattr(incident, field, value)

        response_date = incident.client_response_date
        if response_date and response_date < incident.incident_date:
            raise ValidationError(
                "La respuesta del cliente no puede ser anterior al incidente"
            )

        await self._repo.save()
        return to_response(await self._repo.reload(project_id, incident_id))

    async def delete(self, project_id: UUID, incident_id: UUID) -> None:
        incident = await self._get(project_id, incident_id)
        if incident.applied_days is not None:
            raise ConflictError(
                "Revierte el atraso del cronograma antes de borrar el incidente"
            )
        incident.soft_delete()
        await self._repo.save()

    # ── Reflejar en el cronograma ───────────────────────────────────────────
    async def apply_to_schedule(
        self, project_id: UUID, incident_id: UUID
    ) -> IncidentResponse:
        incident = await self._get(project_id, incident_id)
        if incident.applied_days is not None:
            raise ConflictError("Este atraso ya está reflejado en el cronograma")
        if incident.impact_days <= 0:
            raise ValidationError("El incidente no tiene días de impacto que reflejar")

        project = await self._active_project(project_id)
        await self._shift_project_end(project, incident.impact_days)
        incident.applied_days = incident.impact_days
        incident.applied_at = datetime.now(timezone.utc)
        await self._repo.save()
        return to_response(await self._repo.reload(project_id, incident_id))

    async def apply_pending_to_schedule(
        self, project_id: UUID
    ) -> list[IncidentResponse]:
        """Refleja de una vez todos los atrasos aún no aplicados.

        Es una sola operación (un único desplazamiento por la suma de días):
        o se reflejan todos o ninguno, sin dejar el cronograma a medias si algo
        falla a mitad de camino.
        """
        project = await self._active_project(project_id)
        incidents = await self._repo.list_by_project(project_id)
        pending = [i for i in incidents if i.applied_days is None and i.impact_days > 0]
        if not pending:
            raise ConflictError("No hay atrasos pendientes por reflejar")

        await self._shift_project_end(project, sum(i.impact_days for i in pending))
        now = datetime.now(timezone.utc)
        for incident in pending:
            incident.applied_days = incident.impact_days
            incident.applied_at = now
        await self._repo.save()
        return [to_response(i) for i in incidents]

    async def revert_from_schedule(
        self, project_id: UUID, incident_id: UUID
    ) -> IncidentResponse:
        incident = await self._get(project_id, incident_id)
        if incident.applied_days is None:
            raise ConflictError("Este atraso no está reflejado en el cronograma")

        project = await self._active_project(project_id)
        await self._shift_project_end(project, -incident.applied_days)
        incident.applied_days = None
        incident.applied_at = None
        await self._repo.save()
        return to_response(await self._repo.reload(project_id, incident_id))

    async def _shift_project_end(self, project: Project, days: int) -> None:
        project.end_date = shift_end_date(
            project.end_date, days, start_date=project.start_date
        )
        await self._projects.update(project)

    # ── Evidencias ──────────────────────────────────────────────────────────
    async def add_attachment(
        self,
        project_id: UUID,
        incident_id: UUID,
        *,
        filename: str,
        content_type: str,
        content: bytes,
        uploader_id: UUID,
    ) -> IncidentResponse:
        await self._get(project_id, incident_id)
        name = sanitize_filename(filename)
        # Primero el byte, después la fila: un blob huérfano en disco es inocuo;
        # una fila que apunta a un archivo inexistente rompe la descarga.
        key = self._storage.save(f"incidents/{project_id}", name, content)
        await self._repo.add_attachment(
            IncidentAttachment(
                incident_id=incident_id,
                name=name,
                content_type=content_type or "application/octet-stream",
                size_bytes=len(content),
                storage_key=key,
                uploaded_by=uploader_id,
            )
        )
        return to_response(await self._repo.reload(project_id, incident_id))

    async def get_attachment(
        self, project_id: UUID, incident_id: UUID, attachment_id: UUID
    ) -> IncidentAttachment:
        await self._get(project_id, incident_id)
        attachment = await self._repo.get_attachment(incident_id, attachment_id)
        if attachment is None:
            raise NotFoundError("La evidencia no existe")
        return attachment

    async def delete_attachment(
        self, project_id: UUID, incident_id: UUID, attachment_id: UUID
    ) -> IncidentResponse:
        attachment = await self.get_attachment(project_id, incident_id, attachment_id)
        # Borrado lógico, igual que en el archivador: el byte se queda en disco.
        attachment.soft_delete()
        await self._repo.save()
        return to_response(await self._repo.reload(project_id, incident_id))

    # ── Helpers ─────────────────────────────────────────────────────────────
    async def _active_project(self, project_id: UUID) -> Project:
        project = await self._projects.get_by_id(project_id)
        if project is None or project.is_deleted:
            raise NotFoundError("El proyecto no existe")
        return project

    async def _get(self, project_id: UUID, incident_id: UUID) -> ProjectIncident:
        incident = await self._repo.get(project_id, incident_id)
        if incident is None:
            raise NotFoundError("El incidente no existe")
        return incident
