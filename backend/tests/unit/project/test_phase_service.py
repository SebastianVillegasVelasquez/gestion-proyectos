import uuid

import pytest
from fastapi import HTTPException

from app.modules.project.domain.services import PhaseService
from app.modules.project.infrastructure.models import Phase, Project
from app.modules.project.presentation.schemas import (
    CreatePhaseRequest,
    UpdatePhaseRequest,
)


class FakePhaseRepo:
    def __init__(self) -> None:
        self._store: dict[uuid.UUID, Phase] = {}

    async def get_by_id(self, entity_id):
        return self._store.get(entity_id)

    async def add(self, entity: Phase) -> Phase:
        if getattr(entity, "id", None) is None:
            entity.id = uuid.uuid4()
        self._store[entity.id] = entity
        return entity

    async def update(self, entity: Phase) -> Phase:
        self._store[entity.id] = entity
        return entity

    async def patch(self, entity: Phase, data: dict) -> Phase:
        for field, value in data.items():
            setattr(entity, field, value)
        self._store[entity.id] = entity
        return entity

    async def get_all_by_project_id(self, project_id) -> list[Phase]:
        return sorted(
            (
                p
                for p in self._store.values()
                if p.project_id == project_id and p.deleted_at is None
            ),
            key=lambda p: p.order_index,
        )


class FakeProjectRepo:
    def __init__(self, project: Project | None) -> None:
        self._project = project

    async def get_by_id(self, entity_id):
        if self._project and self._project.id == entity_id:
            return self._project
        return None


def _make_project() -> Project:
    project = Project(name="Demo", description="d")
    project.id = uuid.uuid4()
    project.deleted_at = None
    return project


@pytest.fixture
def project() -> Project:
    return _make_project()


@pytest.fixture
def service(project: Project) -> PhaseService:
    return PhaseService(
        phase_repo=FakePhaseRepo(), project_repo=FakeProjectRepo(project)
    )


class TestCreatePhase:
    async def test_should_assign_incremental_order_index_when_omitted(
        self, service, project
    ):
        first = await service.create_phase(
            project.id, CreatePhaseRequest(name="Planeación")
        )
        second = await service.create_phase(
            project.id, CreatePhaseRequest(name="Producción")
        )

        assert first.order_index == 0
        assert second.order_index == 1
        assert second.project_id == project.id

    async def test_should_respect_explicit_order_index(self, service, project):
        phase = await service.create_phase(
            project.id, CreatePhaseRequest(name="Cierre", order_index=5)
        )
        assert phase.order_index == 5

    async def test_should_persist_optional_duration_and_dates(self, service, project):
        phase = await service.create_phase(
            project.id,
            CreatePhaseRequest(name="Producción", duration_days=10),
        )
        assert phase.duration_days == 10

    async def test_should_404_when_project_missing(self):
        service = PhaseService(
            phase_repo=FakePhaseRepo(), project_repo=FakeProjectRepo(None)
        )
        with pytest.raises(HTTPException) as exc:
            await service.create_phase(uuid.uuid4(), CreatePhaseRequest(name="Fase"))
        assert exc.value.status_code == 404


class TestUpdateAndDeletePhase:
    async def test_should_update_name_and_dates(self, service, project):
        created = await service.create_phase(
            project.id, CreatePhaseRequest(name="Fase 1")
        )
        updated = await service.update_phase(
            project.id,
            created.id,
            UpdatePhaseRequest(name="Fase 1 - Revisada"),
        )
        assert updated.name == "Fase 1 - Revisada"
        assert updated.id == created.id

    async def test_should_404_updating_phase_of_another_project(self, service, project):
        created = await service.create_phase(
            project.id, CreatePhaseRequest(name="Fase 1")
        )
        with pytest.raises(HTTPException) as exc:
            await service.update_phase(
                uuid.uuid4(), created.id, UpdatePhaseRequest(name="Otro")
            )
        assert exc.value.status_code == 404

    async def test_should_soft_delete_phase(self, service, project):
        created = await service.create_phase(
            project.id, CreatePhaseRequest(name="Fase 1")
        )
        await service.delete_phase(project.id, created.id)

        remaining = await service.get_phases(project.id)
        assert all(p.id != created.id for p in remaining)


class TestPhaseDateValidation:
    def test_should_reject_end_before_start(self):
        import datetime

        with pytest.raises(ValueError):
            CreatePhaseRequest(
                name="Fase",
                start_date=datetime.date(2026, 6, 10),
                end_date=datetime.date(2026, 6, 1),
            )
