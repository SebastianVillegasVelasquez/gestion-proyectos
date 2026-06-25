from uuid import UUID

from app.modules.project.structure.domain.repository import WorkTreeRepository
from app.modules.project.structure.domain.services import WorkTreeService
from app.modules.project.structure.presentation.schemas import (
    CloneWorkItemRequest,
    CreateTipoNodoRequest,
    CreateWorkItemRequest,
    TipoNodoResponse,
    UpdateTipoNodoRequest,
    UpdateWorkItemRequest,
    WorkItemDependencyResponse,
    WorkItemResponse,
    WorkItemTreeResponse,
)
from app.shared.base_repository import Repository
from app.shared.exceptions import NotFoundError


async def _ensure_project(project_repo: Repository, proyecto_id: UUID) -> None:
    project = await project_repo.get_by_id(proyecto_id)
    if project is None or getattr(project, "is_deleted", False):
        raise NotFoundError("Proyecto no encontrado")


# ── Tipos de nodo ─────────────────────────────────────────────────────────────
class CreateTipoNodoUseCase:
    def __init__(self, repo: WorkTreeRepository, project_repo: Repository):
        self.service = WorkTreeService(repo)
        self.project_repo = project_repo

    async def execute(
        self, proyecto_id: UUID, data: CreateTipoNodoRequest
    ) -> TipoNodoResponse:
        await _ensure_project(self.project_repo, proyecto_id)
        return await self.service.create_tipo(proyecto_id, data)


class UpdateTipoNodoUseCase:
    def __init__(self, repo: WorkTreeRepository):
        self.service = WorkTreeService(repo)

    async def execute(
        self, tipo_id: UUID, data: UpdateTipoNodoRequest
    ) -> TipoNodoResponse:
        return await self.service.update_tipo(tipo_id, data)


class DeleteTipoNodoUseCase:
    def __init__(self, repo: WorkTreeRepository):
        self.service = WorkTreeService(repo)

    async def execute(self, tipo_id: UUID) -> None:
        await self.service.delete_tipo(tipo_id)


class ListTiposNodoUseCase:
    def __init__(self, repo: WorkTreeRepository):
        self.service = WorkTreeService(repo)

    async def execute(self, proyecto_id: UUID) -> list[TipoNodoResponse]:
        return await self.service.list_tipos(proyecto_id)


# ── Nodos de trabajo ────────────────────────────────────────────────────────────
class CreateWorkItemUseCase:
    def __init__(self, repo: WorkTreeRepository, project_repo: Repository):
        self.service = WorkTreeService(repo)
        self.project_repo = project_repo

    async def execute(
        self, proyecto_id: UUID, data: CreateWorkItemRequest
    ) -> WorkItemResponse:
        await _ensure_project(self.project_repo, proyecto_id)
        return await self.service.create_item(proyecto_id, data)


class UpdateWorkItemUseCase:
    def __init__(self, repo: WorkTreeRepository):
        self.service = WorkTreeService(repo)

    async def execute(
        self, item_id: UUID, data: UpdateWorkItemRequest
    ) -> WorkItemResponse:
        return await self.service.update_item(item_id, data)


class DeleteWorkItemUseCase:
    def __init__(self, repo: WorkTreeRepository):
        self.service = WorkTreeService(repo)

    async def execute(self, item_id: UUID) -> None:
        await self.service.delete_item(item_id)


class GetWorkItemUseCase:
    def __init__(self, repo: WorkTreeRepository):
        self.service = WorkTreeService(repo)

    async def execute(self, item_id: UUID) -> WorkItemResponse:
        return await self.service.get_item(item_id)


class GetWorkTreeUseCase:
    def __init__(self, repo: WorkTreeRepository, project_repo: Repository):
        self.service = WorkTreeService(repo)
        self.project_repo = project_repo

    async def execute(self, proyecto_id: UUID) -> list[WorkItemTreeResponse]:
        await _ensure_project(self.project_repo, proyecto_id)
        return await self.service.get_tree(proyecto_id)


class CloneWorkItemUseCase:
    def __init__(self, repo: WorkTreeRepository):
        self.service = WorkTreeService(repo)

    async def execute(
        self, source_id: UUID, data: CloneWorkItemRequest
    ) -> WorkItemResponse:
        return await self.service.clone_subtree(source_id, data)


# ── Dependencias Finish-to-Start ────────────────────────────────────────────────
class AddWorkItemDependencyUseCase:
    def __init__(self, repo: WorkTreeRepository):
        self.service = WorkTreeService(repo)

    async def execute(
        self, work_item_id: UUID, depends_on_id: UUID
    ) -> WorkItemDependencyResponse:
        return await self.service.add_dependency(work_item_id, depends_on_id)


class RemoveWorkItemDependencyUseCase:
    def __init__(self, repo: WorkTreeRepository):
        self.service = WorkTreeService(repo)

    async def execute(self, work_item_id: UUID, depends_on_id: UUID) -> None:
        await self.service.remove_dependency(work_item_id, depends_on_id)


class ListWorkItemDependenciesUseCase:
    def __init__(self, repo: WorkTreeRepository):
        self.service = WorkTreeService(repo)

    async def execute(self, work_item_id: UUID) -> list[WorkItemDependencyResponse]:
        return await self.service.list_dependencies(work_item_id)
