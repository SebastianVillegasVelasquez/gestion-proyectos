import datetime
import uuid

import pytest
from fastapi import HTTPException

from app.modules.project.domain.services import ProjectNodeService
from app.modules.project.infrastructure.enums import NodeType
from app.modules.project.infrastructure.models import Phase, ProjectNode
from app.modules.project.presentation.schemas import (
    CreateProjectNodeRequest,
    UpdateProjectNodeRequest,
)


class FakeNodeRepo:
    def __init__(self) -> None:
        self._store: dict[uuid.UUID, ProjectNode] = {}

    async def get_by_id(self, entity_id):
        return self._store.get(entity_id)

    async def add(self, entity: ProjectNode) -> ProjectNode:
        if getattr(entity, "id", None) is None:
            entity.id = uuid.uuid4()
        self._store[entity.id] = entity
        return entity

    async def patch(self, entity: ProjectNode, data: dict) -> ProjectNode:
        for field, value in data.items():
            setattr(entity, field, value)
        self._store[entity.id] = entity
        return entity

    async def get_all_by_project_id(self, project_id) -> list[ProjectNode]:
        return [
            n
            for n in self._store.values()
            if n.project_id == project_id and n.deleted_at is None
        ]


class FakePhaseRepo:
    def __init__(self, phase: Phase | None) -> None:
        self._phase = phase

    async def get_by_id(self, entity_id):
        if self._phase and self._phase.id == entity_id:
            return self._phase
        return None


def _make_phase(project_id: uuid.UUID) -> Phase:
    phase = Phase(name="Fase 1", order_index=0, project_id=project_id)
    phase.id = uuid.uuid4()
    phase.deleted_at = None
    return phase


class TestCreateNode:
    async def test_should_pass_through_type_label_and_end_date(self):
        project_id = uuid.uuid4()
        service = ProjectNodeService(FakeNodeRepo())

        result = await service.create_project_node(
            CreateProjectNodeRequest(
                name="Curso de Python",
                node_type=NodeType.MODULO,
                project_id=project_id,
                type_label="Unidad",
                end_date=datetime.date(2026, 9, 30),
            )
        )

        assert result.type_label == "Unidad"
        assert result.end_date == datetime.date(2026, 9, 30)
        assert result.node_type == NodeType.MODULO

    async def test_should_accept_node_with_valid_phase(self):
        project_id = uuid.uuid4()
        phase = _make_phase(project_id)
        service = ProjectNodeService(FakeNodeRepo(), phase_repo=FakePhaseRepo(phase))

        result = await service.create_project_node(
            CreateProjectNodeRequest(
                name="Programa",
                node_type=NodeType.PROGRAMA,
                project_id=project_id,
                phase_id=phase.id,
            )
        )
        assert result.phase_id == phase.id

    async def test_should_reject_phase_from_other_project(self):
        phase = _make_phase(uuid.uuid4())  # phase belongs to a different project
        service = ProjectNodeService(FakeNodeRepo(), phase_repo=FakePhaseRepo(phase))

        with pytest.raises(HTTPException) as exc:
            await service.create_project_node(
                CreateProjectNodeRequest(
                    name="Programa",
                    node_type=NodeType.PROGRAMA,
                    project_id=uuid.uuid4(),
                    phase_id=phase.id,
                )
            )
        assert exc.value.status_code == 404


class TestUpdateNode:
    async def test_should_update_label_and_end_date(self):
        project_id = uuid.uuid4()
        repo = FakeNodeRepo()
        service = ProjectNodeService(repo)
        created = await service.create_project_node(
            CreateProjectNodeRequest(
                name="Modulo",
                node_type=NodeType.MODULO,
                project_id=project_id,
            )
        )

        updated = await service.update_node(
            project_id,
            created.id,
            UpdateProjectNodeRequest(
                type_label="Corte", end_date=datetime.date(2026, 10, 1)
            ),
        )

        assert updated.type_label == "Corte"
        assert updated.end_date == datetime.date(2026, 10, 1)

    async def test_should_404_for_node_of_other_project(self):
        repo = FakeNodeRepo()
        service = ProjectNodeService(repo)
        created = await service.create_project_node(
            CreateProjectNodeRequest(
                name="Modulo",
                node_type=NodeType.MODULO,
                project_id=uuid.uuid4(),
            )
        )

        with pytest.raises(HTTPException) as exc:
            await service.update_node(
                uuid.uuid4(),
                created.id,
                UpdateProjectNodeRequest(type_label="X"),
            )
        assert exc.value.status_code == 404
