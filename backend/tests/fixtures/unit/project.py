from datetime import date, timedelta
from uuid import UUID

import pytest

from app.modules.project.infrastructure.enums import ProjectRole
from app.modules.project.presentation.schemas import (
    CreateProjectRequest,
    ProjectMemberRequest,
)


@pytest.fixture
def fake_create_project_request() -> CreateProjectRequest:
    return CreateProjectRequest(
        name="Sistema de Gestión de Proyectos",
        description="Aplicación para administrar proyectos, tareas y miembros del equipo.",
        client_name="Acme Corporation",
        start_date=date.today() + timedelta(days=1),
        end_date=date.today() + timedelta(days=180),
    )


@pytest.fixture
def valid_project_payload() -> dict:
    return {
        "name": "Test Project",
        "description": "This is a test project",
        "client_name": "Test Client",
        "start_date": "2026-07-01",
        "end_date": "2026-12-31",
    }


@pytest.fixture
def member_project_payload() -> ProjectMemberRequest:
    return ProjectMemberRequest(
        user_id=UUID(int=1), project_id=UUID(int=1), project_role=ProjectRole.INTEGRANTE
    )
