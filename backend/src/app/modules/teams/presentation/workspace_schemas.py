import datetime
from typing import Annotated, Optional
from uuid import UUID

from pydantic import StringConstraints

from app.modules.teams.infrastructure.enums import TeamRole
from app.modules.teams.infrastructure.workspace_enums import (
    CommentType,
    DeliverableStatus,
    ResourceType,
)
from app.shared.base_model import BaseModelConfig

# ── Requests ─────────────────────────────────────────────────────────────────


class CreateDeliverableRequest(BaseModelConfig):
    task_title: Annotated[str, StringConstraints(min_length=2, max_length=300)]
    assignee_id: UUID


class AddVersionRequest(BaseModelConfig):
    type: ResourceType
    url: Annotated[str, StringConstraints(min_length=1, max_length=1000)]
    note: Optional[str] = None


class AddCommentRequest(BaseModelConfig):
    content: Annotated[str, StringConstraints(min_length=1)]
    type: CommentType = CommentType.COMENTARIO
    mentions: list[UUID] = []


# ── Responses ────────────────────────────────────────────────────────────────


class VersionResponse(BaseModelConfig):
    id: UUID
    version_number: int
    type: ResourceType
    url: str
    note: Optional[str] = None
    uploaded_by: UUID
    uploaded_at: datetime.datetime

    @classmethod
    def of(cls, v) -> "VersionResponse":
        return cls(
            id=v.id,
            version_number=v.version_number,
            type=v.resource_type,
            url=v.url,
            note=v.note,
            uploaded_by=v.uploaded_by,
            uploaded_at=v.created_at,
        )


class CommentResponse(BaseModelConfig):
    id: UUID
    author_id: UUID
    content: str
    type: CommentType
    mentions: list[UUID] = []
    created_at: datetime.datetime

    @classmethod
    def of(cls, c) -> "CommentResponse":
        return cls(
            id=c.id,
            author_id=c.author_id,
            content=c.content,
            type=c.comment_type,
            mentions=c.mentions or [],
            created_at=c.created_at,
        )


class DeliverableResponse(BaseModelConfig):
    id: UUID
    team_id: UUID
    task_title: str
    assignee_id: UUID
    status: DeliverableStatus
    versions: list[VersionResponse]
    comments: list[CommentResponse]
    created_at: datetime.datetime
    updated_at: datetime.datetime

    @classmethod
    def of(cls, d) -> "DeliverableResponse":
        return cls(
            id=d.id,
            team_id=d.team_id,
            task_title=d.task_title,
            assignee_id=d.assignee_id,
            status=d.status,
            versions=[VersionResponse.of(v) for v in d.versions],
            comments=[CommentResponse.of(c) for c in d.comments],
            created_at=d.created_at,
            updated_at=d.updated_at,
        )


class WorkspaceAccessResponse(BaseModelConfig):
    """Permisos del usuario actual en el equipo (el servidor decide qué se puede)."""

    team_role: Optional[TeamRole] = None
    can_view: bool
    can_deliver: bool
    can_review: bool


class MyTeamResponse(BaseModelConfig):
    """Equipo al que pertenece el usuario (para el selector de espacios)."""

    id: UUID
    name: str
    description: Optional[str] = None
