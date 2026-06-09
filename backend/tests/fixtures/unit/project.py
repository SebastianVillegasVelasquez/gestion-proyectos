from datetime import date
from typing import List
from uuid import UUID

import pytest

from app.modules.project.infrastructure.enums import NodeType
from app.modules.project.presentation.schemas import (
    CreateProjectRequest,
    CreateProjectNodeRequest,
)


@pytest.fixture
def fake_create_project_request():
    return CreateProjectRequest(
        name="Sistema de Gestión de Proyectos",
        description="Aplicación para administrar proyectos, tareas y miembros del equipo.",
        client_name="Acme Corporation",
        start_date=date(2026, 6, 15),
        end_date=date(2026, 12, 31),
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
