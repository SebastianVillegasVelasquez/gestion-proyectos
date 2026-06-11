from typing import List
from uuid import UUID

from fastapi import HTTPException
from starlette import status

from app.modules.identity.infrastructure.models import User
from app.modules.project.infrastructure.models import ProjectNode, Project
from app.modules.tasks.domain.services import TaskService
from app.modules.tasks.infrastructure.repository import TaskRepository
from app.modules.tasks.presentation.schemas import (
    CreateTaskRequest,
    TaskResponse,
    UpdateTaskRequest,
)
from app.shared.base_repository import Repository


class CreateTaskUseCase:
    def __init__(
        self,
        task_repo: "TaskRepository",
        project_repo: "Repository",
        user_repo: "Repository",
        project_node_repo: "Repository",
    ):
        self.project_repo = project_repo
        self.user_repo = user_repo
        self.project_node_repo = project_node_repo
        self.service = TaskService(task_repo)

    async def execute(
        self, project_id: UUID, node_id: UUID, data: "CreateTaskRequest"
    ) -> "TaskResponse":
        assert project_id, "El ID del proyecto es obligatorio"
        assert node_id, "El ID del nodo es obligatorio"

        project: Project | None = await self.project_repo.get_by_id(project_id)

        if not project or project.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El proyecto con el id {project_id} no existe",
            )

        node: ProjectNode | None = await self.project_node_repo.get_by_id(node_id)

        if not node or node.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El nodo con el id {node_id} no existe",
            )

        if data.assignee_id:
            user: User | None = await self.user_repo.get_by_id(data.assignee_id)

            if not user or user.is_deleted:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"El usuario con el id {data.assignee_id} no existe",
                )

        return await self.service.add_task(data)


class GetTasksByNodeUseCase:
    def __init__(
        self,
        task_repo: "TaskRepository",
        project_repo: "Repository",
        project_node_repo: "Repository",
    ):
        self.project_repo = project_repo
        self.project_node_repo = project_node_repo
        self.service = TaskService(task_repo)

    async def execute(self, project_id: UUID, node_id: UUID) -> List["TaskResponse"]:
        assert project_id, "El ID del proyecto es obligatorio"
        assert node_id, "El ID del nodo es obligatorio"

        project: Project | None = await self.project_repo.get_by_id(project_id)

        if not project or project.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El proyecto con el id {project_id} no existe",
            )

        node: ProjectNode | None = await self.project_node_repo.get_by_id(node_id)

        if not node or node.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El nodo con el id {node_id} no existe",
            )

        return await self.service.get_tasks_by_node(node_id)


class GetTaskByIdUseCase:
    def __init__(
        self,
        task_repo: "TaskRepository",
        project_repo: "Repository",
        project_node_repo: "Repository",
    ):
        self.project_repo = project_repo
        self.project_node_repo = project_node_repo
        self.service = TaskService(task_repo)

    async def execute(
        self, project_id: UUID, node_id: UUID, task_id: UUID
    ) -> "TaskResponse":
        assert project_id, "El ID del proyecto es obligatorio"
        assert node_id, "El ID del nodo es obligatorio"

        project: Project | None = await self.project_repo.get_by_id(project_id)

        if not project or project.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El proyecto con el id {project_id} no existe",
            )

        node: ProjectNode | None = await self.project_node_repo.get_by_id(node_id)

        if not node or node.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El nodo con el id {node_id} no existe",
            )

        task = await self.service.get_task_by_id(task_id)

        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="La tarea no existe"
            )

        return task


class UpdateTaskUseCase:
    def __init__(
        self,
        task_repo: "TaskRepository",
        project_repo: "Repository",
        user_repo: "Repository",
        project_node_repo: "Repository",
    ):
        self.project_repo = project_repo
        self.user_repo = user_repo
        self.project_node_repo = project_node_repo
        self.service = TaskService(task_repo)

    async def execute(
        self, project_id: UUID, node_id: UUID, task_id: UUID, data: "UpdateTaskRequest"
    ) -> "TaskResponse":
        assert project_id, "El ID del proyecto es obligatorio"
        assert node_id, "El ID del nodo es obligatorio"

        project: Project | None = await self.project_repo.get_by_id(project_id)

        if not project or project.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El proyecto con el id {project_id} no existe",
            )

        node: ProjectNode | None = await self.project_node_repo.get_by_id(node_id)

        if not node or node.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El nodo con el id {node_id} no existe",
            )

        if data.assignee_id:
            user: User | None = await self.user_repo.get_by_id(data.assignee_id)

            if not user or user.is_deleted:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"El usuario con el id {data.assignee_id} no existe",
                )

        task = await self.service.update_task(task_id, data)

        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="La tarea no existe"
            )

        return task


class DeleteTaskUseCase:
    def __init__(
        self,
        task_repo: "TaskRepository",
        project_repo: "Repository",
        project_node_repo: "Repository",
    ):
        self.project_repo = project_repo
        self.project_node_repo = project_node_repo
        self.service = TaskService(task_repo)

    async def execute(self, project_id: UUID, node_id: UUID, task_id: UUID) -> None:
        assert project_id, "El ID del proyecto es obligatorio"
        assert node_id, "El ID del nodo es obligatorio"

        project: Project | None = await self.project_repo.get_by_id(project_id)

        if not project or project.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El proyecto con el id {project_id} no existe",
            )

        node: ProjectNode | None = await self.project_node_repo.get_by_id(node_id)

        if not node or node.is_deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"El nodo con el id {node_id} no existe",
            )

        deleted = await self.service.delete_task(task_id)

        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="La tarea no existe"
            )
