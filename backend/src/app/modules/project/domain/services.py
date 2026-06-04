from __future__ import annotations

import uuid
from typing import Optional

from app.core.dependencies import ProjectRepositories
from app.modules.project.presentation.schemas import (
    ModuleCreate,
    ModuleResponse,
    ModuleUpdate,
    ProjectCreateRequest,
    ProjectDetailResponse,
    ProjectMemberAdd,
    ProjectMemberResponse,
    ProjectMemberUpdate,
    ProjectStatusCreate,
    ProjectStatusResponse,
    ProjectStatusUpdate,
    ProjectSummaryResponse,
    ProjectUpdate,
    RiskCreate,
    RiskResponse,
    RiskUpdate,
)
from app.modules.project.infrastructure.models import (
    Module,
    Project,
    ProjectMember,
    ProjectStatus,
    Risk,
)
from app.modules.project.infrastructure.repository import (
    ModuleRepository,
    ProjectMemberRepository,
    ProjectRepository,
    ProjectStatusRepository,
    RiskRepostory,
)
from app.modules.project.infrastructure.enums import ProjectStatusType, ProjectMemberRole
from app.shared.exceptions import ConflictError, NotFoundError, ForbiddenError

_DEFAULT_BASE_STATUSES: list[dict] = [
    {"name": "Por hacer",   "color": "#94A3B8", "order": 0, "base_type": ProjectStatusType.TODO,        "is_default": True,  "is_final": False},
    {"name": "En progreso", "color": "#6366F1", "order": 1, "base_type": ProjectStatusType.IN_PROGRESS, "is_default": False, "is_final": False},
    {"name": "Completado",  "color": "#22C55E", "order": 2, "base_type": ProjectStatusType.DONE,        "is_default": False, "is_final": True},
]

class ProjectService:
    def __init__(
            self,
            project_repo_dependencies: ProjectRepositories
    ) -> None:
        self._project_repo_dependencies = project_repo_dependencies

    async def create_project(self, data: ProjectCreateRequest) -> ProjectDetailResponse:
        project = Project(
            name=data.name,
            description=data.description,
            client_name=data.client_name,
            coordinator_id=data.coordinator_id,
            start_date=data.start_date,
            end_date=data.end_date,
            is_template=data.is_template,
        )
        await self._project_repo_dependencies.project_repo.add(project)

        # Seed de statuses
        statuses_to_seed = data.initial_statuses or [
            ProjectStatusCreate(**s) for s in _DEFAULT_BASE_STATUSES
        ]
        default_status: Optional[ProjectStatus] = None

        for idx, s in enumerate(statuses_to_seed):
            status = ProjectStatus(
                project_id=project.id,
                name=s.name,
                color=s.color,
                order=s.order if s.order is not None else idx,
                is_base=True,
                is_default=s.is_default,
                is_final=s.is_final,
                base_type=s.base_type,
            )
            await self._statuses.add(status)
            if status.is_default:
                default_status = status

        if default_status:
            project.current_status_id = default_status.id
            await self._projects.update(project)

        # Coordinador como miembro ADMIN automáticamente
        member = ProjectMember(
            project_id=project.id,
            user_id=data.coordinator_id,
            role=ProjectMemberRole.ADMIN
        )
        await self._members.add(member)

        return await self.get_project_detail(project.id)


    async def get_project_detail(self, project_id: uuid.UUID) -> ProjectDetailResponse:
        project = await self._projects.get_by_id(project_id)
        if not project:
            raise NotFoundError(f"Project {project_id} not found")
        return ProjectDetailResponse.model_validate(project)

    async def list_projects(
            self,
            coordinator_id: Optional[uuid.UUID] = None,
            is_template: Optional[bool] = None,
    ) -> list[ProjectSummaryResponse]:
        filters: dict = {}
        if coordinator_id:
            filters["coordinator_id"] = coordinator_id
        if is_template is not None:
            filters["is_template"] = is_template
        projects = await self._projects.filter_by(**filters)
        return [ProjectSummaryResponse.model_validate(p) for p in projects]


    async def update_project(
            self, project_id: uuid.UUID, data: ProjectUpdate
    ) -> ProjectDetailResponse:
        project = await self._projects.get_by_id(project_id)
        if not project:
            raise NotFoundError(f"Project {project_id} not found")

        if data.current_status_id:
            status = await self._statuses.get_by_id(data.current_status_id)
            if not status or status.project_id != project_id:
                raise ConflictError("Status does not belong to this project")

        for field, value in data.model_dump(exclude_none=True).items():
            setattr(project, field, value)

        await self._projects.update(project)
        return await self.get_project_detail(project_id)

    # ── Delete (soft) ──────────────────────────────────────────────────────────

    async def delete_project(self, project_id: uuid.UUID) -> None:
        project = await self._projects.get_by_id(project_id)
        if not project:
            raise NotFoundError(f"Project {project_id} not found")
        await self._projects.soft_delete(project)

    # ── Progress ───────────────────────────────────────────────────────────────

    async def recalculate_progress(self, project_id: uuid.UUID) -> float:
        """
        Domain service: el progreso del proyecto es el promedio del
        progress_pct de sus módulos activos (no eliminados).
        Se llama desde los servicios de Task y Module al completarse ítems.
        """
        project = await self._projects.get_by_id(project_id)
        if not project:
            raise NotFoundError(f"Project {project_id} not found")

        modules = [m for m in project.modules if not m.deleted_at]
        if not modules:
            project.progress_pct = 0.0
        else:
            project.progress_pct = sum(m.progress_pct for m in modules) / len(modules)

        await self._projects.update(project)
        return project.progress_pct

    async def list_statuses(self, id):
        pass

class ProjectStatusService:
    def __init__(
            self,
            project_repo: ProjectRepository,
            status_repo: ProjectStatusRepository,
    ) -> None:
        self._projects = project_repo
        self._statuses = status_repo

    async def list_statuses(self, project_id: uuid.UUID) -> list[ProjectStatusResponse]:
        await self._assert_project_exists(project_id)
        statuses = await self._statuses.filter_by(project_id=project_id)
        return [ProjectStatusResponse.model_validate(s) for s in sorted(statuses, key=lambda x: x.order)]

    async def create_status(
            self, project_id: uuid.UUID, data: ProjectStatusCreate
    ) -> ProjectStatusResponse:
        await self._assert_project_exists(project_id)
        await self._assert_name_unique(project_id, data.name)

        status = ProjectStatus(
            project_id=project_id,
            name=data.name,
            color=data.color,
            order=data.order,
            is_base=False,
            is_default=data.is_default,
            is_final=data.is_final,
            base_type=data.base_type,
        )
        await self._statuses.add(status)
        return ProjectStatusResponse.model_validate(status)

    async def update_status(
            self, project_id: uuid.UUID, status_id: uuid.UUID, data: ProjectStatusUpdate
    ) -> ProjectStatusResponse:
        status = await self._get_status_or_404(project_id, status_id)

        if data.name and data.name != status.name:
            await self._assert_name_unique(project_id, data.name)

        for field, value in data.model_dump(exclude_none=True).items():
            setattr(status, field, value)

        await self._statuses.update(status)
        return ProjectStatusResponse.model_validate(status)

    async def delete_status(self, project_id: uuid.UUID, status_id: uuid.UUID) -> None:
        status = await self._get_status_or_404(project_id, status_id)
        if status.is_base:
            raise ForbiddenError("Cannot delete a base status")
        await self._statuses.delete(status)

    # ── Helpers ────────────────────────────────────────────────────────────────

    async def _assert_project_exists(self, project_id: uuid.UUID) -> None:
        if not await self._projects.get_by_id(project_id):
            raise NotFoundError(f"Project {project_id} not found")

    async def _assert_name_unique(self, project_id: uuid.UUID, name: str) -> None:
        existing = await self._statuses.filter_by(project_id=project_id, name=name)
        if existing:
            raise ConflictError(f"Status '{name}' already exists in this project")

    async def _get_status_or_404(
            self, project_id: uuid.UUID, status_id: uuid.UUID
    ) -> ProjectStatus:
        status = await self._statuses.get_by_id(status_id)
        if not status or status.project_id != project_id:
            raise NotFoundError(f"Status {status_id} not found in project {project_id}")
        return status

class ProjectMemberService:
    def __init__(
            self,
            project_repo: ProjectRepository,
            member_repo: ProjectMemberRepository,
    ) -> None:
        self._projects = project_repo
        self._members = member_repo

    async def list_members(self, project_id: uuid.UUID) -> list[ProjectMemberResponse]:
        await self._assert_project_exists(project_id)
        members = await self._members.filter_by(project_id=project_id)
        return [ProjectMemberResponse.model_validate(m) for m in members]

    async def add_member(
            self, project_id: uuid.UUID, data: ProjectMemberAdd
    ) -> ProjectMemberResponse:
        await self._assert_project_exists(project_id)

        existing = await self._members.filter_by(
            project_id=project_id, user_id=data.user_id
        )
        if existing:
            raise ConflictError("User is already a member of this project")

        member = ProjectMember(
            project_id=project_id,
            user_id=data.user_id,
            role=data.role,
        )
        await self._members.add(member)
        return ProjectMemberResponse.model_validate(member)

    async def update_member_role(
            self,
            project_id: uuid.UUID,
            user_id: uuid.UUID,
            data: ProjectMemberUpdate,
    ) -> ProjectMemberResponse:
        member = await self._get_member_or_404(project_id, user_id)
        member.role = data.role
        await self._members.update(member)
        return ProjectMemberResponse.model_validate(member)

    async def remove_member(self, project_id: uuid.UUID, user_id: uuid.UUID) -> None:
        project = await self._projects.get_by_id(project_id)
        if not project:
            raise NotFoundError(f"Project {project_id} not found")
        if project.coordinator_id == user_id:
            raise ForbiddenError("Cannot remove the project coordinator")
        member = await self._get_member_or_404(project_id, user_id)
        await self._members.delete(member)

    # ── Helpers ────────────────────────────────────────────────────────────────

    async def _assert_project_exists(self, project_id: uuid.UUID) -> None:
        if not await self._projects.get_by_id(project_id):
            raise NotFoundError(f"Project {project_id} not found")

    async def _get_member_or_404(
            self, project_id: uuid.UUID, user_id: uuid.UUID
    ) -> ProjectMember:
        results = await self._members.filter_by(
            project_id=project_id, user_id=user_id
        )
        if not results:
            raise NotFoundError(f"Member {user_id} not found in project {project_id}")
        return results[0]

class ModuleService:
    def __init__(
            self,
            project_repo: ProjectRepository,
            module_repo: ModuleRepository,
            project_service: ProjectService,
    ) -> None:
        self._projects = project_repo
        self._modules = module_repo
        self._project_service = project_service

    async def list_modules(self, project_id: uuid.UUID) -> list[ModuleResponse]:
        await self._assert_project_exists(project_id)
        modules = await self._modules.filter_by(project_id=project_id)
        active = [m for m in modules if not m.deleted_at]
        return [ModuleResponse.model_validate(m) for m in sorted(active, key=lambda x: x.order)]

    async def create_module(
            self, project_id: uuid.UUID, data: ModuleCreate
    ) -> ModuleResponse:
        await self._assert_project_exists(project_id)
        module = Module(
            project_id=project_id,
            name=data.name,
            description=data.description,
            order=data.order,
        )
        await self._modules.add(module)
        return ModuleResponse.model_validate(module)

    async def update_module(
            self, project_id: uuid.UUID, module_id: uuid.UUID, data: ModuleUpdate
    ) -> ModuleResponse:
        module = await self._get_module_or_404(project_id, module_id)
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(module, field, value)
        await self._modules.update(module)
        return ModuleResponse.model_validate(module)

    async def delete_module(self, project_id: uuid.UUID, module_id: uuid.UUID) -> None:
        module = await self._get_module_or_404(project_id, module_id)
        await self._modules.soft_delete(module)
        await self._project_service.recalculate_progress(project_id)

    async def update_progress(
            self, project_id: uuid.UUID, module_id: uuid.UUID, progress_pct: float
    ) -> ModuleResponse:
        """Llamado por TaskService cuando cambia el estado de una tarea."""
        module = await self._get_module_or_404(project_id, module_id)
        module.progress_pct = max(0.0, min(100.0, progress_pct))
        await self._modules.update(module)
        await self._project_service.recalculate_progress(project_id)
        return ModuleResponse.model_validate(module)

    # ── Helpers ────────────────────────────────────────────────────────────────

    async def _assert_project_exists(self, project_id: uuid.UUID) -> None:
        if not await self._projects.get_by_id(project_id):
            raise NotFoundError(f"Project {project_id} not found")

    async def _get_module_or_404(
            self, project_id: uuid.UUID, module_id: uuid.UUID
    ) -> Module:
        module = await self._modules.get_by_id(module_id)
        if not module or module.project_id != project_id or module.deleted_at:
            raise NotFoundError(f"Module {module_id} not found in project {project_id}")
        return module

class RiskService:
    def __init__(
            self,
            project_repo: ProjectRepository,
            risk_repo: RiskRepostory,
    ) -> None:
        self._projects = project_repo
        self._risks = risk_repo

    async def list_risks(
            self, project_id: uuid.UUID, only_active: bool = True
    ) -> list[RiskResponse]:
        await self._assert_project_exists(project_id)
        risks = await self._risks.filter_by(project_id=project_id)
        if only_active:
            risks = [r for r in risks if r.is_active]
        return [RiskResponse.model_validate(r) for r in risks]

    async def create_risk(
            self, project_id: uuid.UUID, data: RiskCreate
    ) -> RiskResponse:
        await self._assert_project_exists(project_id)
        risk = Risk(
            project_id=project_id,
            title=data.title,
            description=data.description,
            level=data.level,
            mitigation=data.mitigation,
        )
        await self._risks.add(risk)
        return RiskResponse.model_validate(risk)

    async def update_risk(
            self, project_id: uuid.UUID, risk_id: uuid.UUID, data: RiskUpdate
    ) -> RiskResponse:
        risk = await self._get_risk_or_404(project_id, risk_id)
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(risk, field, value)
        await self._risks.update(risk)
        return RiskResponse.model_validate(risk)

    async def deactivate_risk(
            self, project_id: uuid.UUID, risk_id: uuid.UUID
    ) -> RiskResponse:
        risk = await self._get_risk_or_404(project_id, risk_id)
        risk.is_active = False
        await self._risks.update(risk)
        return RiskResponse.model_validate(risk)

    async def delete_risk(self, project_id: uuid.UUID, risk_id: uuid.UUID) -> None:
        risk = await self._get_risk_or_404(project_id, risk_id)
        await self._risks.delete(risk)

    # ── Helpers ────────────────────────────────────────────────────────────────

    async def _assert_project_exists(self, project_id: uuid.UUID) -> None:
        if not await self._projects.get_by_id(project_id):
            raise NotFoundError(f"Project {project_id} not found")

    async def _get_risk_or_404(
            self, project_id: uuid.UUID, risk_id: uuid.UUID
    ) -> Risk:
        risk = await self._risks.get_by_id(risk_id)
        if not risk or risk.project_id != project_id:
            raise NotFoundError(f"Risk {risk_id} not found in project {project_id}")
        return risk