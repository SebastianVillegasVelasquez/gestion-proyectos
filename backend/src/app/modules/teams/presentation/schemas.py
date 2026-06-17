from typing import Annotated, Optional
from uuid import UUID

from pydantic import StringConstraints

from app.modules.teams.infrastructure.enums import TeamRole
from app.shared.base_model import BaseModelConfig


class CreateTeamRequest(BaseModelConfig):
    name: Annotated[str, StringConstraints(min_length=2, max_length=150)]
    description: Optional[str] = None


class UpdateTeamRequest(BaseModelConfig):
    name: Annotated[str, StringConstraints(min_length=2, max_length=150)] | None = None
    description: Optional[str] = None


class TeamResponse(BaseModelConfig):
    id: UUID
    name: str
    description: Optional[str] = None
    member_count: int = 0


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
