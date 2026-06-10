import pytest
from fastapi import HTTPException

from app.modules.identity.infrastructure.enums import UserRole
from app.modules.identity.infrastructure.models import User
from app.modules.identity.presentation.schemas import CreateUserRequest
from app.modules.project.domain.services import ProjectMemberService
from app.modules.project.infrastructure.models import Project
from app.modules.project.presentation.schemas import (
    ProjectMemberRequest,
    CreateProjectRequest,
)
from app.shared.base_repository import Repository


class TestProjectMemberServices:
    @pytest.mark.skip(
        "Integration test works but this one not because a fake repository logic"
    )
    async def test_member_should_be_added_to_project(
        self,
        fake_project_members_repo: Repository,
        fake_project_repository: Repository,
        fake_user_repo: Repository,
        member_project_payload: ProjectMemberRequest,
        fake_user: CreateUserRequest,
        fake_create_project_request: CreateProjectRequest,
    ):
        persisted_user = await fake_user_repo.add(User(**fake_user.model_dump()))
        persisted_project = await fake_project_repository.add(
            Project(**fake_create_project_request.model_dump())
        )

        service = ProjectMemberService(
            project_repo=fake_project_repository,
            user_repo=fake_user_repo,
            project_member_repo=fake_project_members_repo,  # type: ignore
        )

        project_member = ProjectMemberRequest(
            user_id=persisted_user.id,
            project_id=persisted_project.id,
            role=UserRole.INTEGRANTE,
        )

        persisted_data = await service.add_member_to_project(project_member)

        assert persisted_data.project_id == project_member.project_id
        assert persisted_data.user_id == project_member.user_id
        assert persisted_data.role == project_member.role

    async def test_member_should_raise_404_when_user_does_not_exist(
        self,
        fake_project_members_repo: Repository,
        fake_project_repository: Repository,
        fake_user_repo: Repository,
        member_project_payload: ProjectMemberRequest,
        fake_create_project_request: CreateProjectRequest,
    ):
        service = ProjectMemberService(
            project_repo=fake_project_repository,
            user_repo=fake_user_repo,
            project_member_repo=fake_project_members_repo,  # type: ignore
        )

        persisted_project = await fake_project_repository.add(
            Project(**fake_create_project_request.model_dump())
        )

        member_project_payload.project_id = persisted_project.id

        with pytest.raises(HTTPException, match="Usuario no encontrado") as exc_info:
            await service.add_member_to_project(member_project_payload)

        assert exc_info.value.status_code == 404

    async def test_member_should_raise_404_when_project_does_not_exist(
        self,
        fake_project_members_repo: Repository,
        fake_project_repository: Repository,
        fake_user_repo: Repository,
        member_project_payload: ProjectMemberRequest,
        fake_user: CreateUserRequest,
    ):
        service = ProjectMemberService(
            project_repo=fake_project_repository,
            user_repo=fake_user_repo,
            project_member_repo=fake_project_members_repo,  # type: ignore
        )

        persisted_user = await fake_user_repo.add(User(**fake_user.model_dump()))

        member_project_payload.user_id = persisted_user.id

        with pytest.raises(HTTPException, match="Proyecto no encontrado") as exc_info:
            await service.add_member_to_project(member_project_payload)

        assert exc_info.value.status_code == 404
