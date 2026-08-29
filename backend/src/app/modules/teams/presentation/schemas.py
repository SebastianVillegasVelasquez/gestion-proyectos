import datetime
from typing import Annotated, Optional
from uuid import UUID

from pydantic import StringConstraints

from app.modules.teams.infrastructure.enums import InvitationStatus, TeamRole
from app.shared.base_model import BaseModelConfig


class CreateTeamRequest(BaseModelConfig):
    name: Annotated[str, StringConstraints(min_length=2, max_length=150)]
    description: Optional[str] = None


class UpdateTeamRequest(BaseModelConfig):
    name: Annotated[str, StringConstraints(min_length=2, max_length=150)] | None = None
    description: Optional[str] = None


class TeamResponse(BaseModelConfig):
    id: UUID
    project_id: UUID
    name: str
    description: Optional[str] = None
    member_count: int = 0
    assigned_tasks: int = 0
    completed_tasks: int = 0
    completion_pct: int = 0


class PaginatedTeamsResponse(BaseModelConfig):
    items: list[TeamResponse]
    total: int
    page: int
    page_size: int


class AddTeamMemberRequest(BaseModelConfig):
    user_id: UUID
    # Por defecto entra como integrante; el admin puede cambiarlo luego.
    team_role: TeamRole = TeamRole.INTEGRANTE


class ChangeTeamRoleRequest(BaseModelConfig):
    team_role: TeamRole


class TeamMemberResponse(BaseModelConfig):
    user_id: UUID
    name: str
    last_name: str
    position: str
    team_role: TeamRole


class CreateInvitationRequest(BaseModelConfig):
    user_id: UUID


class InvitationResponse(BaseModelConfig):
    id: UUID
    team_id: UUID
    team_name: str
    project_id: UUID
    user_id: UUID
    user_name: str
    invited_by_id: UUID
    invited_by_name: str
    status: InvitationStatus
    created_at: datetime.datetime
    responded_at: Optional[datetime.datetime] = None

    @classmethod
    def of(cls, inv) -> "InvitationResponse":
        def _full_name(u) -> str:
            return f"{u.name} {u.last_name}".strip() if u else ""

        return cls(
            id=inv.id,
            team_id=inv.team_id,
            team_name=inv.team.name if inv.team else "",
            project_id=inv.team.project_id if inv.team else inv.team_id,
            user_id=inv.user_id,
            user_name=_full_name(inv.user),
            invited_by_id=inv.invited_by_id,
            invited_by_name=_full_name(inv.invited_by),
            status=inv.status,
            created_at=inv.created_at,
            responded_at=inv.responded_at,
        )
