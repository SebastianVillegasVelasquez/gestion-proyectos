from datetime import date, timedelta
from typing import List
from uuid import UUID

import pytest

from app.modules.project.infrastructure.enums import NodeType, ProjectRole
from app.modules.project.presentation.schemas import (
    CreateProjectRequest,
    CreateProjectNodeRequest,
    ProjectMemberRequest,
)


@pytest.fixture
def fake_create_project_request() -> CreateProjectRequest:
    # Fechas relativas a hoy: la regla "inicio no puede ser pasado" rechazaba un
    # date() hardcodeado en cuanto la fecha real lo superaba.
    return CreateProjectRequest(
        name="Sistema de Gestión de Proyectos",
        description="Aplicación para administrar proyectos, tareas y miembros del equipo.",
        client_name="Acme Corporation",
        start_date=date.today() + timedelta(days=1),
        end_date=date.today() + timedelta(days=180),
    )


@pytest.fixture
def fake_create_project_node_chain_request() -> List[CreateProjectNodeRequest]:
    project_id = UUID(int=1)
    return [
        CreateProjectNodeRequest(
            name="Programa Raíz", node_type=NodeType.PROGRAMA, project_id=project_id
        ),
        CreateProjectNodeRequest(
            name="Curso Hijo", node_type=NodeType.CURSO, project_id=project_id
        ),
        CreateProjectNodeRequest(
            name="Módulo Nieto", node_type=NodeType.MODULO, project_id=project_id
        ),
    ]


@pytest.fixture
def fake_project_node() -> CreateProjectNodeRequest:
    return CreateProjectNodeRequest(
        name="Modulo Hijo",
        node_type=NodeType.MODULO,
        parent_id=UUID(int=1),
        project_id=UUID(int=1),
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
