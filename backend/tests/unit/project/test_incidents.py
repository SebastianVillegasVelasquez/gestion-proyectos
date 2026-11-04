"""Bitácora de incidentes: regla de desplazamiento, validación y servicio.

El servicio se prueba con repositorios en memoria: lo que importa aquí es la
regla "registrar no mueve el cronograma; aplicar/revertir sí, y son inversas".
"""

import uuid
from datetime import date, datetime, timezone
from types import SimpleNamespace

import pytest
from pydantic import ValidationError as PydanticValidationError

from app.modules.project.incidents.application.service import ProjectIncidentService
from app.modules.project.incidents.domain.schedule import shift_end_date
from app.modules.project.incidents.infrastructure.models import ProjectIncident
from app.modules.project.incidents.presentation.schemas import (
    CreateIncidentRequest,
    IncidentResponse,
    UpdateIncidentRequest,
)
from app.shared.exceptions import ConflictError, NotFoundError, ValidationError

PROJECT_ID = uuid.uuid4()
USER_ID = uuid.uuid4()


class FakeIncidentRepo:
    def __init__(self) -> None:
        self.rows: dict[uuid.UUID, ProjectIncident] = {}

    async def add(self, incident):
        incident.id = uuid.uuid4()
        incident.created_at = datetime.now(timezone.utc)
        incident.deleted_at = None
        incident.applied_days = None
        incident.applied_at = None
        self.rows[incident.id] = incident
        return incident

    async def get(self, project_id, incident_id):
        row = self.rows.get(incident_id)
        if row is None or row.project_id != project_id or row.is_deleted:
            return None
        return row

    async def reload(self, project_id, incident_id):
        return self.rows[incident_id]

    async def list_by_project(self, project_id):
        return [r for r in self.rows.values() if not r.is_deleted]

    async def save(self):
        return None


class FakeProjectRepo:
    def __init__(self, start: date | None, end: date | None) -> None:
        self.project = SimpleNamespace(
            id=PROJECT_ID, start_date=start, end_date=end, is_deleted=False
        )

    async def get_by_id(self, project_id):
        return self.project if project_id == PROJECT_ID else None

    async def update(self, project):
        return project


def make_service(end: date | None = date(2026, 6, 30)):
    projects = FakeProjectRepo(start=date(2026, 1, 1), end=end)
    service = ProjectIncidentService(FakeIncidentRepo(), projects, storage=None)
    return service, projects.project


def payload(**overrides) -> CreateIncidentRequest:
    data = {
        "title": "Sin acceso SSH al servidor",
        "incident_date": date(2026, 3, 10),
        "impact_days": 2,
    }
    return CreateIncidentRequest(**{**data, **overrides})


class TestShiftEndDate:
    def test_moves_forward_and_back_symmetrically(self):
        end = date(2026, 6, 30)
        assert shift_end_date(shift_end_date(end, 5), -5) == end

    def test_requires_an_end_date(self):
        with pytest.raises(ValidationError):
            shift_end_date(None, 3)

    def test_never_lands_before_the_start_date(self):
        with pytest.raises(ValidationError):
            shift_end_date(date(2026, 1, 5), -10, start_date=date(2026, 1, 1))


class TestSchemas:
    def test_response_before_incident_is_rejected(self):
        with pytest.raises(PydanticValidationError):
            payload(client_response_date=date(2026, 3, 1))

    def test_negative_impact_is_rejected(self):
        with pytest.raises(PydanticValidationError):
            payload(impact_days=-1)

    def test_client_response_days_is_derived(self):
        response = IncidentResponse(
            id=uuid.uuid4(),
            project_id=PROJECT_ID,
            title="t",
            responsible="cliente",
            incident_date=date(2026, 3, 10),
            impact_days=2,
            client_response_date=date(2026, 3, 14),
            created_at=datetime.now(timezone.utc),
        )
        assert response.client_response_days == 4
        assert response.is_applied is False


class TestIncidentService:
    async def test_creating_does_not_touch_the_schedule(self):
        service, project = make_service()
        await service.create(PROJECT_ID, payload(), USER_ID)
        assert project.end_date == date(2026, 6, 30)

    async def test_apply_then_revert_restores_the_end_date(self):
        service, project = make_service()
        created = await service.create(PROJECT_ID, payload(impact_days=2), USER_ID)

        applied = await service.apply_to_schedule(PROJECT_ID, created.id)
        assert project.end_date == date(2026, 7, 2)
        assert applied.is_applied and applied.applied_days == 2

        reverted = await service.revert_from_schedule(PROJECT_ID, created.id)
        assert project.end_date == date(2026, 6, 30)
        assert not reverted.is_applied

    async def test_cannot_apply_twice(self):
        service, _ = make_service()
        created = await service.create(PROJECT_ID, payload(), USER_ID)
        await service.apply_to_schedule(PROJECT_ID, created.id)
        with pytest.raises(ConflictError):
            await service.apply_to_schedule(PROJECT_ID, created.id)

    async def test_cannot_revert_what_was_never_applied(self):
        service, _ = make_service()
        created = await service.create(PROJECT_ID, payload(), USER_ID)
        with pytest.raises(ConflictError):
            await service.revert_from_schedule(PROJECT_ID, created.id)

    async def test_cannot_apply_without_impact_days(self):
        service, _ = make_service()
        created = await service.create(PROJECT_ID, payload(impact_days=0), USER_ID)
        with pytest.raises(ValidationError):
            await service.apply_to_schedule(PROJECT_ID, created.id)

    async def test_cannot_apply_when_project_has_no_end_date(self):
        service, _ = make_service(end=None)
        created = await service.create(PROJECT_ID, payload(), USER_ID)
        with pytest.raises(ValidationError):
            await service.apply_to_schedule(PROJECT_ID, created.id)

    async def test_impact_days_are_locked_while_applied(self):
        service, _ = make_service()
        created = await service.create(PROJECT_ID, payload(), USER_ID)
        await service.apply_to_schedule(PROJECT_ID, created.id)
        with pytest.raises(ConflictError):
            await service.update(
                PROJECT_ID, created.id, UpdateIncidentRequest(impact_days=9)
            )

    async def test_applied_incident_cannot_be_deleted(self):
        service, _ = make_service()
        created = await service.create(PROJECT_ID, payload(), USER_ID)
        await service.apply_to_schedule(PROJECT_ID, created.id)
        with pytest.raises(ConflictError):
            await service.delete(PROJECT_ID, created.id)

    async def test_client_response_can_be_added_later_and_cleared(self):
        service, _ = make_service()
        created = await service.create(PROJECT_ID, payload(), USER_ID)

        updated = await service.update(
            PROJECT_ID,
            created.id,
            UpdateIncidentRequest(client_response_date=date(2026, 3, 13)),
        )
        assert updated.client_response_days == 3

        cleared = await service.update(
            PROJECT_ID,
            created.id,
            UpdateIncidentRequest.model_validate({"client_response_date": None}),
        )
        assert cleared.client_response_date is None

    async def test_response_date_before_incident_is_rejected_on_update(self):
        service, _ = make_service()
        created = await service.create(PROJECT_ID, payload(), USER_ID)
        with pytest.raises(ValidationError):
            await service.update(
                PROJECT_ID,
                created.id,
                UpdateIncidentRequest(client_response_date=date(2026, 3, 1)),
            )

    async def test_unknown_project_is_not_found(self):
        service, _ = make_service()
        with pytest.raises(NotFoundError):
            await service.list(uuid.uuid4())
