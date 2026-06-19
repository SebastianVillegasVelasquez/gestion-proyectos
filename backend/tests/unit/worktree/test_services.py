"""Tests unitarios del árbol de trabajo recursivo.

Demuestran la Inversión de Dependencias: el `WorkTreeService` opera contra un
fake en memoria del `WorkTreeRepository`, sin SQLAlchemy ni base de datos.
"""

import datetime
import uuid

import pytest

from app.modules.project.structure.domain.repository import WorkTreeRepository
from app.modules.project.structure.domain.services import WorkTreeService
from app.modules.project.structure.infrastructure.enums import DuracionUnidad
from app.modules.project.structure.infrastructure.models import (
    TipoNodo,
    WorkItem,
    WorkItemDependency,
)
from app.modules.project.structure.presentation.schemas import (
    CreateTipoNodoRequest,
    CreateWorkItemRequest,
)
from app.shared.exceptions import ConflictError, NotFoundError, ValidationError

D = datetime.date


class FakeWorkTreeRepository(WorkTreeRepository):
    def __init__(self) -> None:
        self._tipos: dict[uuid.UUID, TipoNodo] = {}
        self._items: dict[uuid.UUID, WorkItem] = {}
        self._deps: list[WorkItemDependency] = []

    async def add_tipo(self, tipo: TipoNodo) -> TipoNodo:
        if tipo.id is None:
            tipo.id = uuid.uuid4()
        self._tipos[tipo.id] = tipo
        return tipo

    async def save_tipo(self, tipo: TipoNodo) -> TipoNodo:
        self._tipos[tipo.id] = tipo
        return tipo

    async def get_tipo(self, tipo_id):
        return self._tipos.get(tipo_id)

    async def get_tipo_by_nombre(self, proyecto_id, nombre):
        for tipo in self._tipos.values():
            if (
                tipo.nombre == nombre
                and tipo.proyecto_id == proyecto_id
                and not tipo.is_deleted
            ):
                return tipo
        return None

    async def list_tipos(self, proyecto_id):
        return [
            t
            for t in self._tipos.values()
            if not t.is_deleted
            and (t.proyecto_id == proyecto_id or t.proyecto_id is None)
        ]

    async def add_item(self, item: WorkItem) -> WorkItem:
        if item.id is None:
            item.id = uuid.uuid4()
        self._items[item.id] = item
        self._attach_tipo(item)
        return item

    async def save_item(self, item: WorkItem) -> WorkItem:
        self._items[item.id] = item
        self._attach_tipo(item)
        return item

    async def get_item(self, item_id):
        item = self._items.get(item_id)
        if item is not None:
            self._attach_tipo(item)
        return item

    async def list_items(self, proyecto_id):
        items = [
            i
            for i in self._items.values()
            if i.proyecto_id == proyecto_id and not i.is_deleted
        ]
        for item in items:
            self._attach_tipo(item)
        items.sort(key=lambda i: i.orden)
        return items

    async def next_orden(self, proyecto_id, parent_id):
        siblings = [
            i.orden
            for i in self._items.values()
            if i.proyecto_id == proyecto_id
            and i.parent_id == parent_id
            and not i.is_deleted
        ]
        return max(siblings, default=-1) + 1

    async def soft_delete_many(self, item_ids):
        for item_id in item_ids:
            item = self._items.get(item_id)
            if item is not None:
                item.soft_delete()

    async def add_dependency(self, dependency):
        if dependency.id is None:
            dependency.id = uuid.uuid4()
        self._deps.append(dependency)
        return dependency

    async def get_dependency(self, work_item_id, depends_on_id):
        for dep in self._deps:
            if dep.work_item_id == work_item_id and dep.depends_on_id == depends_on_id:
                return dep
        return None

    async def delete_dependency(self, dependency):
        self._deps = [d for d in self._deps if d.id != dependency.id]

    async def list_dependencies(self, work_item_id):
        return [d for d in self._deps if d.work_item_id == work_item_id]

    async def list_predecessors(self, work_item_id):
        pred_ids = [
            d.depends_on_id for d in self._deps if d.work_item_id == work_item_id
        ]
        return [
            self._items[i]
            for i in pred_ids
            if i in self._items and not self._items[i].is_deleted
        ]

    async def list_dependency_edges(self, proyecto_id):
        return [
            (d.work_item_id, d.depends_on_id)
            for d in self._deps
            if d.work_item_id in self._items
            and self._items[d.work_item_id].proyecto_id == proyecto_id
        ]

    def _attach_tipo(self, item: WorkItem) -> None:
        item.tipo = self._tipos.get(item.tipo_id)


@pytest.fixture
def service() -> WorkTreeService:
    return WorkTreeService(FakeWorkTreeRepository())


PROYECTO = uuid.uuid4()


async def _tipo(service, nombre, reglas=None):
    return await service.create_tipo(
        PROYECTO, CreateTipoNodoRequest(nombre=nombre, reglas_anidacion=reglas)
    )


async def _item(service, tipo_id, nombre, parent_id=None):
    return await service.create_item(
        PROYECTO,
        CreateWorkItemRequest(tipo_id=tipo_id, nombre=nombre, parent_id=parent_id),
    )


class TestTipoNodo:
    async def test_create_tipo(self, service):
        tipo = await _tipo(service, "Programa")
        assert tipo.nombre == "Programa"
        assert tipo.proyecto_id == PROYECTO

    async def test_create_tipo_rejects_duplicate(self, service):
        await _tipo(service, "Fase")
        with pytest.raises(ConflictError):
            await _tipo(service, "Fase")


class TestWorkItemTree:
    async def test_builds_arbitrary_hierarchy(self, service):
        # Modo Unicafam: Programa → Curso → Módulo → Fase, sin código por nivel.
        t_prog = await _tipo(service, "Programa")
        t_curso = await _tipo(service, "Curso")
        t_mod = await _tipo(service, "Módulo")
        t_fase = await _tipo(service, "Fase")

        prog = await _item(service, t_prog.id, "Programa de Datos")
        curso = await _item(service, t_curso.id, "Curso 1", parent_id=prog.id)
        modulo = await _item(service, t_mod.id, "Módulo 1", parent_id=curso.id)
        await _item(service, t_fase.id, "Validación disciplinar", parent_id=modulo.id)

        tree = await service.get_tree(PROYECTO)

        assert len(tree) == 1
        assert tree[0].nombre == "Programa de Datos"
        assert tree[0].children[0].nombre == "Curso 1"
        assert tree[0].children[0].children[0].nombre == "Módulo 1"
        fase = tree[0].children[0].children[0].children[0]
        assert fase.nombre == "Validación disciplinar"

    async def test_second_hierarchy_without_code_change(self, service):
        # Modo FONTUR: Proyecto → Componente → Actividad, mismos endpoints.
        t_comp = await _tipo(service, "Componente")
        t_act = await _tipo(service, "Actividad")
        comp = await _item(service, t_comp.id, "Componente 1")
        await _item(service, t_act.id, "Frente transversal", parent_id=comp.id)

        tree = await service.get_tree(PROYECTO)
        assert tree[0].children[0].nombre == "Frente transversal"

    async def test_orden_autoincrements_among_siblings(self, service):
        t = await _tipo(service, "Etapa")
        a = await _item(service, t.id, "A")
        b = await _item(service, t.id, "B")
        c = await _item(service, t.id, "C")
        assert (a.orden, b.orden, c.orden) == (0, 1, 2)

    async def test_rejects_parent_from_other_project(self, service):
        otro_proyecto = uuid.uuid4()
        t_local = await _tipo(service, "Etapa")
        t_foreign = await service.create_tipo(
            otro_proyecto, CreateTipoNodoRequest(nombre="Etapa")
        )
        foreign = await service.create_item(
            otro_proyecto,
            CreateWorkItemRequest(tipo_id=t_foreign.id, nombre="Ajeno"),
        )
        with pytest.raises(ValidationError):
            await _item(service, t_local.id, "Hijo", parent_id=foreign.id)

    async def test_nesting_rules_enforced_when_defined(self, service):
        t_fase = await _tipo(service, "Fase")
        # Un Módulo que solo admite hijos de tipo Fase.
        t_mod = await _tipo(
            service,
            "Módulo",
            reglas={"tipos_hijos_permitidos": [str(t_fase.id)]},
        )
        t_curso = await _tipo(service, "Curso")
        modulo = await _item(service, t_mod.id, "Módulo 1")

        # Una Fase sí entra…
        await _item(service, t_fase.id, "Fase 1", parent_id=modulo.id)
        # …pero un Curso no.
        with pytest.raises(ValidationError):
            await _item(service, t_curso.id, "Curso colado", parent_id=modulo.id)

    async def test_delete_removes_whole_subtree(self, service):
        t = await _tipo(service, "Nodo")
        prog = await _item(service, t.id, "Programa")
        curso = await _item(service, t.id, "Curso", parent_id=prog.id)
        await _item(service, t.id, "Módulo", parent_id=curso.id)

        await service.delete_item(curso.id)

        tree = await service.get_tree(PROYECTO)
        assert len(tree) == 1
        assert tree[0].nombre == "Programa"
        assert tree[0].children == []  # curso y su módulo se borraron

    async def test_get_missing_item_raises(self, service):
        with pytest.raises(NotFoundError):
            await service.get_item(uuid.uuid4())


class TestDateDerivationInService:
    async def test_create_with_inicio_and_duration_derives_end(self, service):
        t = await _tipo(service, "Fase")
        item = await service.create_item(
            PROYECTO,
            CreateWorkItemRequest(
                tipo_id=t.id,
                nombre="F1",
                fecha_inicio_plan=D(2026, 6, 1),
                duracion_valor=5,
                duracion_unidad=DuracionUnidad.DIAS,
            ),
        )
        assert item.fecha_inicio_plan == D(2026, 6, 1)
        assert item.fecha_fin_plan == D(2026, 6, 6)

    async def test_create_with_end_and_duration_derives_start(self, service):
        t = await _tipo(service, "Fase")
        item = await service.create_item(
            PROYECTO,
            CreateWorkItemRequest(
                tipo_id=t.id,
                nombre="F1",
                fecha_fin_plan=D(2026, 6, 10),
                duracion_valor=4,
                duracion_unidad=DuracionUnidad.DIAS,
            ),
        )
        assert item.fecha_inicio_plan == D(2026, 6, 6)

    async def test_create_only_duration_inherits_parent_start(self, service):
        t = await _tipo(service, "Nodo")
        parent = await service.create_item(
            PROYECTO,
            CreateWorkItemRequest(
                tipo_id=t.id,
                nombre="Padre",
                fecha_inicio_plan=D(2026, 7, 1),
                fecha_fin_plan=D(2026, 7, 30),
            ),
        )
        child = await service.create_item(
            PROYECTO,
            CreateWorkItemRequest(
                tipo_id=t.id,
                nombre="Hijo",
                parent_id=parent.id,
                duracion_valor=3,
                duracion_unidad=DuracionUnidad.DIAS,
            ),
        )
        assert child.fecha_inicio_plan == D(2026, 7, 1)
        assert child.fecha_fin_plan == D(2026, 7, 4)

    async def test_create_inconsistent_dates_flags_warning(self, service):
        t = await _tipo(service, "Fase")
        item = await service.create_item(
            PROYECTO,
            CreateWorkItemRequest(
                tipo_id=t.id,
                nombre="F1",
                fecha_inicio_plan=D(2026, 6, 1),
                fecha_fin_plan=D(2026, 6, 30),
                duracion_valor=5,
                duracion_unidad=DuracionUnidad.DIAS,
            ),
        )
        assert item.advertencia_fechas is True
        assert item.fecha_fin_plan == D(2026, 6, 30)  # prevalece el par de fechas


class TestDependencies:
    async def _two_items(self, service):
        t = await _tipo(service, "Fase")
        pred = await service.create_item(
            PROYECTO,
            CreateWorkItemRequest(
                tipo_id=t.id,
                nombre="Pred",
                fecha_inicio_plan=D(2026, 6, 1),
                duracion_valor=5,
                duracion_unidad=DuracionUnidad.DIAS,
            ),
        )
        succ = await service.create_item(
            PROYECTO,
            CreateWorkItemRequest(
                tipo_id=t.id,
                nombre="Succ",
                duracion_valor=3,
                duracion_unidad=DuracionUnidad.DIAS,
            ),
        )
        return pred, succ

    async def test_dependency_positions_successor_after_predecessor(self, service):
        pred, succ = await self._two_items(service)
        assert pred.fecha_fin_plan == D(2026, 6, 6)

        await service.add_dependency(succ.id, pred.id)

        repositioned = await service.get_item(succ.id)
        assert repositioned.fecha_inicio_plan == D(2026, 6, 7)  # fin del pred + 1
        assert repositioned.fecha_fin_plan == D(2026, 6, 10)

    async def test_self_dependency_rejected(self, service):
        _, succ = await self._two_items(service)
        with pytest.raises(ValidationError):
            await service.add_dependency(succ.id, succ.id)

    async def test_duplicate_dependency_rejected(self, service):
        pred, succ = await self._two_items(service)
        await service.add_dependency(succ.id, pred.id)
        with pytest.raises(ConflictError):
            await service.add_dependency(succ.id, pred.id)

    async def test_cycle_rejected(self, service):
        pred, succ = await self._two_items(service)
        await service.add_dependency(succ.id, pred.id)
        # Cerrar el ciclo: pred dependería de succ.
        with pytest.raises(ValidationError):
            await service.add_dependency(pred.id, succ.id)

    async def test_fts_violation_with_explicit_early_start(self, service):
        t = await _tipo(service, "Fase")
        pred = await service.create_item(
            PROYECTO,
            CreateWorkItemRequest(
                tipo_id=t.id,
                nombre="Pred",
                fecha_inicio_plan=D(2026, 6, 10),
                fecha_fin_plan=D(2026, 6, 20),
            ),
        )
        early = await service.create_item(
            PROYECTO,
            CreateWorkItemRequest(
                tipo_id=t.id,
                nombre="Empieza antes",
                fecha_inicio_plan=D(2026, 6, 1),
                fecha_fin_plan=D(2026, 6, 5),
            ),
        )
        with pytest.raises(ValidationError):
            await service.add_dependency(early.id, pred.id)

    async def test_remove_dependency_recomputes(self, service):
        pred, succ = await self._two_items(service)
        await service.add_dependency(succ.id, pred.id)
        assert (await service.get_item(succ.id)).fecha_inicio_plan == D(2026, 6, 7)

        await service.remove_dependency(succ.id, pred.id)

        # Sin predecesor ni padre, "solo duración" queda sin posicionar.
        recomputed = await service.get_item(succ.id)
        assert recomputed.fecha_inicio_plan is None
        assert await service.list_dependencies(succ.id) == []
