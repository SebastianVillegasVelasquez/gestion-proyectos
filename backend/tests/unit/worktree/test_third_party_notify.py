"""El caso de uso avisa a los responsables cuando una "actividad de terceros"
recibe o cambia su fecha de entrega.
"""

import datetime
import uuid

import pytest

from app.modules.project.structure.application.use_cases import UpdateWorkItemUseCase
from app.modules.project.structure.presentation.schemas import (
    CreateTipoNodoRequest,
    CreateWorkItemRequest,
    UpdateWorkItemRequest,
)
from app.modules.tasks.infrastructure.models import Task
from app.shared.events import EventBus
from app.shared.events.events import ThirdPartyDeliveryDateSet

from tests.unit.worktree.test_services import FakeWorkTreeRepository, WorkTreeService

D = datetime.date
PROYECTO = uuid.uuid4()


class FakeTaskRepo:
    def __init__(self, tasks: list[Task]) -> None:
        self._tasks = tasks

    async def get_all_by_project(self, project_id):
        return [t for t in self._tasks if t.project_id == project_id]


@pytest.fixture
def repo() -> FakeWorkTreeRepository:
    return FakeWorkTreeRepository()


@pytest.fixture
def service(repo) -> WorkTreeService:
    return WorkTreeService(repo)


async def _tercero_con_hijo(service):
    tercero_tipo = await service.create_tipo(
        PROYECTO,
        CreateTipoNodoRequest(nombre="Proveedor", es_dependencia_externa=True),
    )
    normal_tipo = await service.create_tipo(
        PROYECTO, CreateTipoNodoRequest(nombre="Fase")
    )
    padre = await service.create_item(
        PROYECTO, CreateWorkItemRequest(tipo_id=normal_tipo.id, nombre="Módulo")
    )
    hijo = await service.create_item(
        PROYECTO,
        CreateWorkItemRequest(tipo_id=normal_tipo.id, nombre="H", parent_id=padre.id),
    )
    tercero = await service.create_item(
        PROYECTO,
        CreateWorkItemRequest(
            tipo_id=tercero_tipo.id, nombre="Entrega del proveedor", parent_id=padre.id
        ),
    )
    # El gate reparenta al hijo previo bajo el tercero.
    return tercero, hijo


def _bus_collecting(events: list) -> EventBus:
    bus = EventBus()

    async def collect(event) -> None:
        events.append(event)

    bus.subscribe(ThirdPartyDeliveryDateSet, collect)
    return bus


class TestThirdPartyDeliveryNotification:
    async def test_publishes_to_assignees_of_child_tasks_on_date_set(
        self, repo, service
    ):
        tercero, hijo = await _tercero_con_hijo(service)
        assignee = uuid.uuid4()
        task_repo = FakeTaskRepo(
            [
                Task(
                    id=uuid.uuid4(),
                    title="Trabajo que espera al proveedor",
                    project_id=PROYECTO,
                    work_item_id=hijo.id,
                    assignee_id=assignee,
                )
            ]
        )
        events: list[ThirdPartyDeliveryDateSet] = []
        actor = uuid.uuid4()

        await UpdateWorkItemUseCase(repo, task_repo, _bus_collecting(events)).execute(
            tercero.id,
            UpdateWorkItemRequest(fecha_fin_plan=D(2026, 9, 15)),
            actor_id=actor,
        )

        assert len(events) == 1
        assert events[0].recipient_ids == (assignee,)
        assert events[0].delivery_date == D(2026, 9, 15)
        assert events[0].actor_id == actor
        assert events[0].work_item_id == tercero.id

    async def test_no_event_when_date_unchanged(self, repo, service):
        tercero, hijo = await _tercero_con_hijo(service)
        task_repo = FakeTaskRepo(
            [
                Task(
                    id=uuid.uuid4(),
                    title="X",
                    project_id=PROYECTO,
                    work_item_id=hijo.id,
                    assignee_id=uuid.uuid4(),
                )
            ]
        )
        events: list = []
        uc = UpdateWorkItemUseCase(repo, task_repo, _bus_collecting(events))
        await uc.execute(
            tercero.id, UpdateWorkItemRequest(fecha_fin_plan=D(2026, 9, 15))
        )
        events.clear()
        # Segundo PATCH con la MISMA fecha: sin evento.
        await uc.execute(
            tercero.id, UpdateWorkItemRequest(fecha_fin_plan=D(2026, 9, 15))
        )
        assert events == []

    async def test_no_event_for_a_plain_type(self, repo, service):
        normal_tipo = await service.create_tipo(
            PROYECTO, CreateTipoNodoRequest(nombre="Fase")
        )
        item = await service.create_item(
            PROYECTO, CreateWorkItemRequest(tipo_id=normal_tipo.id, nombre="Normal")
        )
        events: list = []
        await UpdateWorkItemUseCase(
            repo, FakeTaskRepo([]), _bus_collecting(events)
        ).execute(item.id, UpdateWorkItemRequest(fecha_fin_plan=D(2026, 9, 15)))
        assert events == []

    async def test_no_event_when_no_child_task_has_an_assignee(self, repo, service):
        tercero, hijo = await _tercero_con_hijo(service)
        task_repo = FakeTaskRepo(
            [
                Task(
                    id=uuid.uuid4(),
                    title="Sin responsable",
                    project_id=PROYECTO,
                    work_item_id=hijo.id,
                    assignee_id=None,
                )
            ]
        )
        events: list = []
        await UpdateWorkItemUseCase(repo, task_repo, _bus_collecting(events)).execute(
            tercero.id, UpdateWorkItemRequest(fecha_fin_plan=D(2026, 9, 15))
        )
        assert events == []
