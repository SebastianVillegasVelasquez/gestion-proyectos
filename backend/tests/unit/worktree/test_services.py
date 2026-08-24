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

    async def test_delete_tipo_reassigns_items_to_editable_default(self, service):
        # Al borrar un tipo, sus elementos no quedan huérfanos: pasan a un tipo
        # real "Elemento" (que aparece en el catálogo y se puede editar/filtrar).
        tipo = await _tipo(service, "Módulo")
        item = await _item(service, tipo.id, "Módulo 1")

        await service.delete_tipo(tipo.id)

        tipos = await service.list_tipos(PROYECTO)
        nombres = {t.nombre for t in tipos}
        assert "Módulo" not in nombres
        assert "Elemento" in nombres

        default = next(t for t in tipos if t.nombre == "Elemento")
        tree = await service.get_tree(PROYECTO)
        assert tree[0].id == item.id
        assert tree[0].tipo_id == default.id


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


class TestCloneSubtree:
    """Clonado profundo (spec §9): copia subárbol con desplazamiento opcional.

    Resetea fechas reales y avance, preserva FtS internas, descarta externas,
    rechaza pegar dentro de sí mismo.
    """

    async def _module_with_phases(self, service):
        # Programa → 2 módulos hermanos; cada módulo con 2 fases en duración.
        t_prog = await _tipo(service, "Programa")
        t_mod = await _tipo(service, "Módulo")
        t_fase = await _tipo(service, "Fase")
        prog = await service.create_item(
            PROYECTO,
            CreateWorkItemRequest(
                tipo_id=t_prog.id,
                nombre="Programa",
                fecha_inicio_plan=D(2026, 6, 1),
                fecha_fin_plan=D(2026, 8, 30),
            ),
        )
        mod_a = await _item(service, t_mod.id, "Módulo A", parent_id=prog.id)
        f1 = await service.create_item(
            PROYECTO,
            CreateWorkItemRequest(
                tipo_id=t_fase.id,
                nombre="F1",
                parent_id=mod_a.id,
                fecha_inicio_plan=D(2026, 6, 1),
                duracion_valor=5,
                duracion_unidad=DuracionUnidad.DIAS,
            ),
        )
        f2 = await service.create_item(
            PROYECTO,
            CreateWorkItemRequest(
                tipo_id=t_fase.id,
                nombre="F2",
                parent_id=mod_a.id,
                duracion_valor=3,
                duracion_unidad=DuracionUnidad.DIAS,
            ),
        )
        mod_b = await _item(service, t_mod.id, "Módulo B", parent_id=prog.id)
        return prog, mod_a, mod_b, f1, f2

    async def test_clones_subtree_with_internal_structure(self, service):
        from app.modules.project.structure.presentation.schemas import (
            CloneWorkItemRequest,
        )

        _, mod_a, mod_b, *_ = await self._module_with_phases(service)

        clone = await service.clone_subtree(
            mod_a.id, CloneWorkItemRequest(target_parent_id=mod_b.id)
        )

        tree = await service.get_tree(PROYECTO)
        prog = tree[0]
        children_names = [c.nombre for c in prog.children]
        assert children_names == ["Módulo A", "Módulo B"]
        # El clon vive ahora dentro de Módulo B y trajo sus 2 fases.
        b_children = prog.children[1].children
        assert len(b_children) == 1
        assert b_children[0].nombre == "Módulo A"  # nombre conservado
        assert {c.nombre for c in b_children[0].children} == {"F1", "F2"}
        # El clon es independiente del original (otro id).
        assert clone.id != mod_a.id

    async def test_clones_with_date_offset_and_rename(self, service):
        from app.modules.project.structure.presentation.schemas import (
            CloneWorkItemRequest,
        )

        _, mod_a, _, *_ = await self._module_with_phases(service)

        clone = await service.clone_subtree(
            mod_a.id,
            CloneWorkItemRequest(
                target_parent_id=None,
                offset_days=14,
                rename_root_to="Módulo A (copia)",
            ),
        )

        assert clone.nombre == "Módulo A (copia)"
        # El nodo raíz del clon va a la raíz del proyecto.
        assert clone.parent_id is None
        # F1 del original empezaba el 1 de junio; el clon, 14 días después.
        cloned_tree = await service.get_tree(PROYECTO)
        cloned_mod = next(n for n in cloned_tree if n.nombre == "Módulo A (copia)")
        f1_clone = next(c for c in cloned_mod.children if c.nombre == "F1")
        assert f1_clone.fecha_inicio_plan == D(2026, 6, 15)

    async def test_resets_avance_in_clone(self, service):
        from app.modules.project.structure.presentation.schemas import (
            CloneWorkItemRequest,
        )

        # Marca avance real en el original y verifica que el clon nace en limpio.
        t = await _tipo(service, "Nodo")
        orig = await service.create_item(
            PROYECTO,
            CreateWorkItemRequest(
                tipo_id=t.id,
                nombre="Con avance",
                fecha_inicio_plan=D(2026, 6, 1),
                fecha_fin_plan=D(2026, 6, 30),
                fecha_inicio_real=D(2026, 6, 2),
                porcentaje_completado=0.5,
            ),
        )

        clone = await service.clone_subtree(orig.id, CloneWorkItemRequest())

        assert clone.fecha_inicio_real is None
        assert clone.fecha_fin_real is None
        assert clone.porcentaje_completado is None

    async def test_preserves_internal_fts_drops_external(self, service):
        """Una FtS entre dos fases del subárbol se replica entre los clones.
        Una FtS desde una fase del subárbol hacia un nodo externo se descarta."""
        from app.modules.project.structure.presentation.schemas import (
            CloneWorkItemRequest,
        )

        _, mod_a, mod_b, f1, f2 = await self._module_with_phases(service)
        # Interna: F2 depende de F1 (ambas dentro del subárbol que se clona).
        await service.add_dependency(f2.id, f1.id)
        # Externa: F1 depende de Módulo B (fuera del subárbol).
        await service.add_dependency(f1.id, mod_b.id)

        clone = await service.clone_subtree(
            mod_a.id, CloneWorkItemRequest(target_parent_id=mod_b.id)
        )

        # Identificar los clones de F1 y F2.
        cloned_root = await service.get_item(clone.id)
        # El árbol del proyecto ahora contiene el subárbol clonado bajo mod_b.
        proj_tree = await service.get_tree(PROYECTO)
        mod_b_node = proj_tree[0].children[1]
        cloned_mod_a = mod_b_node.children[0]
        cloned_f1 = next(c for c in cloned_mod_a.children if c.nombre == "F1")
        cloned_f2 = next(c for c in cloned_mod_a.children if c.nombre == "F2")

        cloned_f2_deps = await service.list_dependencies(cloned_f2.id)
        assert len(cloned_f2_deps) == 1
        assert cloned_f2_deps[0].depends_on_id == cloned_f1.id

        cloned_f1_deps = await service.list_dependencies(cloned_f1.id)
        assert cloned_f1_deps == []  # la externa NO se copia
        assert cloned_root.nombre == "Módulo A"

    async def test_rejects_paste_inside_itself(self, service):
        from app.modules.project.structure.presentation.schemas import (
            CloneWorkItemRequest,
        )

        _, mod_a, _, f1, _ = await self._module_with_phases(service)
        # Pegar el módulo A *dentro de su propia fase* crearía una recursión.
        with pytest.raises(ValidationError):
            await service.clone_subtree(
                mod_a.id, CloneWorkItemRequest(target_parent_id=f1.id)
            )


def _find_in_tree(nodes, item_id):
    for node in nodes:
        if node.id == item_id:
            return node
        found = _find_in_tree(node.children, item_id)
        if found is not None:
            return found
    return None


class TestMoveWorkItem:
    async def _ordered_children(self, service, parent_id):
        """Nombres de los hijos de `parent_id` (o de la raíz) por su `orden`."""
        tree = await service.get_tree(PROYECTO)
        nodes = tree if parent_id is None else _find_in_tree(tree, parent_id).children
        return [n.nombre for n in sorted(nodes, key=lambda n: n.orden)]

    async def test_reparents_and_appends_at_end(self, service):
        t = await _tipo(service, "Nodo")
        a = await _item(service, t.id, "A")
        b = await _item(service, t.id, "B")
        await _item(service, t.id, "B-hijo", parent_id=b.id)  # ya ocupa orden 0
        child = await _item(service, t.id, "Hijo", parent_id=a.id)

        moved = await service.move_item(child.id, b.id, None)

        assert moved.parent_id == b.id
        assert moved.orden == 1  # tras el hijo existente de B

    async def test_moves_to_root(self, service):
        t = await _tipo(service, "Nodo")
        a = await _item(service, t.id, "A")
        child = await _item(service, t.id, "Hijo", parent_id=a.id)

        moved = await service.move_item(child.id, None, None)

        assert moved.parent_id is None

    async def test_reorders_siblings_within_same_parent(self, service):
        t = await _tipo(service, "Nodo")
        await _item(service, t.id, "A")
        await _item(service, t.id, "B")
        c = await _item(service, t.id, "C")
        assert await self._ordered_children(service, None) == ["A", "B", "C"]

        # Mover C al frente (índice 0) → se re-secuencia a C, A, B.
        moved = await service.move_item(c.id, None, 0)
        assert moved.orden == 0
        assert await self._ordered_children(service, None) == ["C", "A", "B"]

    async def test_inserts_between_siblings(self, service):
        t = await _tipo(service, "Nodo")
        await _item(service, t.id, "A")
        await _item(service, t.id, "B")
        c = await _item(service, t.id, "C")
        # Insertar C en el índice 1 (entre A y B); el índice excluye al movido.
        await service.move_item(c.id, None, 1)
        assert await self._ordered_children(service, None) == ["A", "C", "B"]

    async def test_compacts_old_parent_after_reparent(self, service):
        t = await _tipo(service, "Nodo")
        a = await _item(service, t.id, "A")
        x = await _item(service, t.id, "X", parent_id=a.id)
        await _item(service, t.id, "Y", parent_id=a.id)
        await _item(service, t.id, "Z", parent_id=a.id)
        # A tiene X(0) Y(1) Z(2); sacar X a la raíz compacta a Y(0) Z(1).
        await service.move_item(x.id, None, None)
        assert await self._ordered_children(service, a.id) == ["Y", "Z"]

    async def test_rejects_self_parent(self, service):
        t = await _tipo(service, "Nodo")
        a = await _item(service, t.id, "A")
        with pytest.raises(ValidationError):
            await service.move_item(a.id, a.id, None)

    async def test_rejects_move_into_own_descendant(self, service):
        t = await _tipo(service, "Nodo")
        a = await _item(service, t.id, "A")
        child = await _item(service, t.id, "Hijo", parent_id=a.id)
        with pytest.raises(ValidationError):
            await service.move_item(a.id, child.id, None)

    async def test_respects_nesting_rules(self, service):
        t_allowed = await _tipo(service, "Permitido")
        t_forbidden = await _tipo(service, "Prohibido")
        t_parent = await _tipo(
            service, "Padre", reglas={"tipos_hijos_permitidos": [str(t_allowed.id)]}
        )
        parent = await _item(service, t_parent.id, "Padre 1")
        orphan = await _item(service, t_forbidden.id, "Huérfano")
        with pytest.raises(ValidationError):
            await service.move_item(orphan.id, parent.id, None)


class TestShiftSubtree:
    async def _dated(self, service, tipo_id, nombre, inicio, fin, parent_id=None):
        return await service.create_item(
            PROYECTO,
            CreateWorkItemRequest(
                tipo_id=tipo_id,
                nombre=nombre,
                parent_id=parent_id,
                fecha_inicio_plan=inicio,
                fecha_fin_plan=fin,
            ),
        )

    async def test_shifts_whole_subtree_forward(self, service):
        t = await _tipo(service, "Nodo")
        root = await self._dated(service, t.id, "R", D(2026, 1, 1), D(2026, 1, 10))
        child = await self._dated(
            service, t.id, "C", D(2026, 1, 3), D(2026, 1, 8), parent_id=root.id
        )

        resp, ids = await service.shift_subtree(root.id, 5)

        assert set(ids) == {root.id, child.id}
        assert resp.fecha_inicio_plan == D(2026, 1, 6)
        assert resp.fecha_fin_plan == D(2026, 1, 15)
        moved_child = await service.get_item(child.id)
        assert moved_child.fecha_inicio_plan == D(2026, 1, 8)
        assert moved_child.fecha_fin_plan == D(2026, 1, 13)

    async def test_negative_offset_moves_back(self, service):
        t = await _tipo(service, "Nodo")
        root = await self._dated(service, t.id, "R", D(2026, 3, 10), D(2026, 3, 20))
        resp, _ = await service.shift_subtree(root.id, -4)
        assert resp.fecha_inicio_plan == D(2026, 3, 6)

    async def test_zero_offset_is_noop(self, service):
        t = await _tipo(service, "Nodo")
        root = await self._dated(service, t.id, "R", D(2026, 1, 1), D(2026, 1, 10))
        resp, _ = await service.shift_subtree(root.id, 0)
        assert resp.fecha_inicio_plan == D(2026, 1, 1)

    async def test_leaves_siblings_outside_subtree_untouched(self, service):
        t = await _tipo(service, "Nodo")
        root = await self._dated(service, t.id, "R", D(2026, 1, 1), D(2026, 1, 10))
        sibling = await self._dated(service, t.id, "S", D(2026, 1, 1), D(2026, 1, 10))
        await service.shift_subtree(root.id, 7)
        unchanged = await service.get_item(sibling.id)
        assert unchanged.fecha_inicio_plan == D(2026, 1, 1)
