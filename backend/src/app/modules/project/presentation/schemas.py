# import datetime
# import uuid
# from typing import Annotated, Optional
#
# from pydantic import field_validator, Field, StringConstraints
#
# from app.modules.project.infrastructure.enums import (
#     ProjectStatusType,
#     ProjectMemberRole,
#     RiskLevel,
# )
# from app.shared.base_model import BaseModelConfig
#
# StatusName = Annotated[
#     str,
#     StringConstraints(max_length=100),
# ]
#
# HexColor = Annotated[
#     str,
#     StringConstraints(pattern=r"^#[0-9A-Fa-f]{6}$"),
# ]
#
# DisplayOrder = Annotated[
#     int,
#     Field(ge=0),
# ]
#
#
# class ProjectStatusCreate(BaseModelConfig):
#     name: StatusName
#     color: HexColor = "#6366F1"
#     order: DisplayOrder = 0
#     is_default: bool = False
#     is_final: bool = False
#     base_type: ProjectStatusType | None = None
#
#
# class ProjectStatusUpdate(BaseModelConfig):
#     name: StatusName | None = None
#     color: HexColor | None = None
#     order: DisplayOrder | None = None
#     is_default: bool | None = None
#     is_final: bool | None = None
#
#
# class ProjectStatusResponse(BaseModelConfig):
#     id: uuid.UUID
#     project_id: uuid.UUID
#     name: StatusName
#     color: HexColor
#     order: DisplayOrder
#     is_base: bool
#     is_default: bool
#     is_final: bool
#     base_type: ProjectStatusType | None
#     created_at: datetime.datetime
#     updated_at: datetime.datetime
#
#
# # ══════════════════════════════════════════════════════════════════════════════
# # PROJECT MEMBER
# # ══════════════════════════════════════════════════════════════════════════════
#
#
# class ProjectMemberAdd(BaseModelConfig):
#     user_id: uuid.UUID
#     role: ProjectMemberRole = ProjectMemberRole.MEMBER
#
#
# class ProjectMemberUpdate(BaseModelConfig):
#     role: ProjectMemberRole
#
#
# class ProjectMemberResponse(BaseModelConfig):
#     id: uuid.UUID
#     project_id: uuid.UUID
#     user_id: uuid.UUID
#     role: ProjectMemberRole
#     created_at: datetime.datetime
#
#
# # ══════════════════════════════════════════════════════════════════════════════
# # MODULE
# # ══════════════════════════════════════════════════════════════════════════════
#
#
# class ModuleCreate(BaseModelConfig):
#     name: Annotated[
#         str,
#         StringConstraints(max_length=200),
#     ]
#
#     description: str | None = None
#
#     order: Annotated[
#         int,
#         Field(ge=0),
#     ] = 0
#
#
# class ModuleUpdate(BaseModelConfig):
#     name: (
#         Annotated[
#             str,
#             StringConstraints(max_length=200),
#         ]
#         | None
#     ) = None
#
#     description: str | None = None
#
#     order: (
#         Annotated[
#             int,
#             Field(ge=0),
#         ]
#         | None
#     ) = None
#
#
# class ModuleResponse(BaseModelConfig):
#     id: uuid.UUID
#     project_id: uuid.UUID
#
#     name: Annotated[
#         str,
#         StringConstraints(max_length=200),
#     ]
#
#     description: str | None
#
#     order: Annotated[
#         int,
#         Field(ge=0),
#     ]
#
#     progress_pct: float
#     created_at: datetime.datetime
#     updated_at: datetime.datetime
#
#
# # ══════════════════════════════════════════════════════════════════════════════
# # RISK
# # ══════════════════════════════════════════════════════════════════════════════
#
#
# class RiskCreate(BaseModelConfig):
#     title: Annotated[
#         str,
#         StringConstraints(max_length=300),
#     ]
#
#     description: str | None = None
#     level: RiskLevel = RiskLevel.MEDIUM
#     mitigation: str | None = None
#
#
# class RiskUpdate(BaseModelConfig):
#     title: (
#         Annotated[
#             str,
#             StringConstraints(max_length=300),
#         ]
#         | None
#     ) = None
#
#     description: str | None = None
#     level: RiskLevel | None = None
#     mitigation: str | None = None
#     is_active: bool | None = None
#
#
# class RiskResponse(BaseModelConfig):
#     id: uuid.UUID
#     project_id: uuid.UUID
#
#     title: Annotated[
#         str,
#         StringConstraints(max_length=300),
#     ]
#
#     description: str | None
#     level: RiskLevel
#     mitigation: str | None
#     is_active: bool
#
#     created_at: datetime.datetime
#     updated_at: datetime.datetime
#
#
# # ══════════════════════════════════════════════════════════════════════════════
# # PROJECT
# # ══════════════════════════════════════════════════════════════════════════════
#
#
# class ProjectCreateRequest(BaseModelConfig):
#     name: Annotated[
#         str,
#         StringConstraints(max_length=300),
#     ]
#
#     description: str | None = None
#
#     client_name: (
#         Annotated[
#             str,
#             StringConstraints(max_length=200),
#         ]
#         | None
#     ) = None
#
#     coordinator_id: uuid.UUID
#
#     start_date: (
#         Annotated[
#             str,
#             StringConstraints(pattern=r"^\d{4}-\d{2}-\d{2}$"),
#         ]
#         | None
#     ) = None
#
#     end_date: (
#         Annotated[
#             str,
#             StringConstraints(pattern=r"^\d{4}-\d{2}-\d{2}$"),
#         ]
#         | None
#     ) = None
#
#     is_template: bool = False
#
#     initial_statuses: list[ProjectStatusCreate] = Field(default_factory=list)
#
#     @field_validator("end_date")
#     @classmethod
#     def end_after_start(cls, v: str | None, info) -> str | None:
#         start = info.data.get("start_date")
#         if v and start and v < start:
#             raise ValueError("end_date must be >= start_date")
#         return v
#
#
# class ProjectUpdate(BaseModelConfig):
#     name: (
#         Annotated[
#             str,
#             StringConstraints(max_length=300),
#         ]
#         | None
#     ) = None
#
#     description: str | None = None
#
#     client_name: (
#         Annotated[
#             str,
#             StringConstraints(max_length=200),
#         ]
#         | None
#     ) = None
#
#     coordinator_id: uuid.UUID | None = None
#
#     start_date: (
#         Annotated[
#             str,
#             StringConstraints(pattern=r"^\d{4}-\d{2}-\d{2}$"),
#         ]
#         | None
#     ) = None
#
#     end_date: (
#         Annotated[
#             str,
#             StringConstraints(pattern=r"^\d{4}-\d{2}-\d{2}$"),
#         ]
#         | None
#     ) = None
#
#     current_status_id: uuid.UUID | None = None
#
#
# class ProjectSummaryResponse(BaseModelConfig):
#     id: uuid.UUID
#
#     name: Annotated[
#         str,
#         StringConstraints(max_length=300),
#     ]
#
#     client_name: (
#         Annotated[
#             str,
#             StringConstraints(max_length=200),
#         ]
#         | None
#     )
#
#     progress_pct: float
#     current_status: ProjectStatusResponse | None
#
#     start_date: (
#         Annotated[
#             str,
#             StringConstraints(pattern=r"^\d{4}-\d{2}-\d{2}$"),
#         ]
#         | None
#     )
#
#     end_date: (
#         Annotated[
#             str,
#             StringConstraints(pattern=r"^\d{4}-\d{2}-\d{2}$"),
#         ]
#         | None
#     )
#
#     is_template: bool
#     created_at: datetime.datetime
#
#
# class ProjectDetailResponse(ProjectSummaryResponse):
#     description: str | None
#     coordinator_id: uuid.UUID
#
#     statuses: list[ProjectStatusResponse] = []
#     members: list[ProjectMemberResponse] = []
#     modules: list[ModuleResponse] = []
#     risks: list[RiskResponse] = []
#     duplicated_from_id: Optional[uuid.UUID] = None
#
#     updated_at: datetime.datetime
