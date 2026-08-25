import datetime
from uuid import UUID

from app.modules.project.structure.domain.date_engine import (
    DerivedDates,
    derive_dates,
    viola_fts,
)
from app.modules.project.structure.domain.repository import WorkTreeRepository
from app.modules.project.structure.infrastructure.models import (
    TipoNodo,
    WorkItem,
    WorkItemDependency,
)
from app.modules.project.structure.presentation.schemas import (
    CloneWorkItemRequest,
    CreateTipoNodoRequest,
    CreateWorkItemRequest,
    TipoNodoResponse,
    UpdateTipoNodoRequest,
    UpdateWorkItemRequest,
    WorkItemDependencyResponse,
    WorkItemResponse,
    WorkItemTreeResponse,
)
from app.shared.exceptions import ConflictError, NotFoundError, ValidationError

# Nombre del tipo por defecto al que se reasignan los elementos cuyo tipo se
# elimina. Sigue siendo un tipo real (editable/filtrable), no un hueco.
DEFAULT_TIPO_NOMBRE = "Elemento"


class WorkTreeService:
    """Reglas del árbol de trabajo recursivo. Depende de la abstracción del repo.

    Las fechas plan se almacenan tal como las da el usuario (los campos pueden
    quedar vacíos en modo "solo duración"); las fechas efectivas se DERIVAN en
    lectura propagando el motor por el árbol y las dependencias FtS. Así no se
    pierde el "modo" de cada nodo al recalcular.
    """

    def __init__(self, repo: WorkTreeRepository):
        self.repo = repo

    # ── Tipos de nodo ─────────────────────────────────────────────────────────
    async def create_tipo(
        self, proyecto_id: UUID, data: CreateTipoNodoRequest
    ) -> TipoNodoResponse:
        if await self.repo.get_tipo_by_nombre(proyecto_id, data.nombre) is not None:
            raise ConflictError(
                "Ya existe un tipo de nodo con ese nombre en el proyecto"
            )
        tipo = await self.repo.add_tipo(
            TipoNodo(
                proyecto_id=proyecto_id,
                nombre=data.nombre,
                color=data.color,
                icono=data.icono,
                reglas_anidacion=data.reglas_anidacion,
            )
        )
        return self._to_tipo_response(tipo)

    async def update_tipo(
        self, tipo_id: UUID, data: UpdateTipoNodoRequest
    ) -> TipoNodoResponse:
        tipo = await self._get_active_tipo(tipo_id)
        if data.nombre and data.nombre != tipo.nombre:
            existing = await self.repo.get_tipo_by_nombre(tipo.proyecto_id, data.nombre)
            if existing is not None and existing.id != tipo_id:
                raise ConflictError(
                    "Ya existe un tipo de nodo con ese nombre en el proyecto"
                )
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(tipo, field, value)
        saved = await self.repo.save_tipo(tipo)
        return self._to_tipo_response(saved)

    async def delete_tipo(self, tipo_id: UUID) -> None:
        tipo = await self._get_active_tipo(tipo_id)
        tipo.soft_delete()
        await self.repo.save_tipo(tipo)
        # Los elementos que usaban este tipo se reasignan a un tipo por defecto
        # "Elemento" (creado si hace falta): así siguen en el catálogo, editables
        # y filtrables, en vez de quedar huérfanos apuntando a un tipo borrado.
        if tipo.proyecto_id is not None:
            await self._reassign_to_default_tipo(tipo.proyecto_id, tipo_id)

    async def _reassign_to_default_tipo(
        self, proyecto_id: UUID, from_tipo_id: UUID
    ) -> None:
        items = await self.repo.list_items(proyecto_id)
        orphans = [item for item in items if item.tipo_id == from_tipo_id]
        if not orphans:
            return
        default = await self._get_or_create_default_tipo(proyecto_id)
        for item in orphans:
            item.tipo_id = default.id
            await self.repo.save_item(item)

    async def _get_or_create_default_tipo(self, proyecto_id: UUID) -> TipoNodo:
        existing = await self.repo.get_tipo_by_nombre(proyecto_id, DEFAULT_TIPO_NOMBRE)
        if existing is not None:
            return existing
        return await self.repo.add_tipo(
            TipoNodo(proyecto_id=proyecto_id, nombre=DEFAULT_TIPO_NOMBRE)
        )

    async def list_tipos(self, proyecto_id: UUID) -> list[TipoNodoResponse]:
        tipos = await self.repo.list_tipos(proyecto_id)
        return [self._to_tipo_response(t) for t in tipos]

    # ── Nodos de trabajo ──────────────────────────────────────────────────────
    async def create_item(
        self, proyecto_id: UUID, data: CreateWorkItemRequest
    ) -> WorkItemResponse:
        tipo = await self._get_valid_tipo_for_project(data.tipo_id, proyecto_id)

        if data.parent_id is not None:
            parent = await self._get_active_item(data.parent_id)
            if parent.proyecto_id != proyecto_id:
                raise ValidationError("El nodo padre pertenece a otro proyecto")
            self._validate_nesting(parent, tipo)

        orden = data.orden
        if orden is None:
            orden = await self.repo.next_orden(proyecto_id, data.parent_id)

        # Se guardan las ENTRADAS del usuario tal cual (no las fechas derivadas).
        item = await self.repo.add_item(
            WorkItem(
                proyecto_id=proyecto_id,
                parent_id=data.parent_id,
                tipo_id=data.tipo_id,
                nombre=data.nombre,
                orden=orden,
                prioridad=data.prioridad,
                fecha_inicio_plan=data.fecha_inicio_plan,
                fecha_fin_plan=data.fecha_fin_plan,
                duracion_valor=data.duracion_valor,
                duracion_unidad=data.duracion_unidad,
                fecha_inicio_real=data.fecha_inicio_real,
                fecha_fin_real=data.fecha_fin_real,
                porcentaje_completado=data.porcentaje_completado,
                es_transversal=data.es_transversal,
            )
        )
        return await self._respond_item(item)

    async def update_item(
        self, item_id: UUID, data: UpdateWorkItemRequest
    ) -> WorkItemResponse:
        item = await self._get_active_item(item_id)
        payload = data.model_dump(exclude_unset=True)
        if "tipo_id" in payload and payload["tipo_id"] is not None:
            await self._get_valid_tipo_for_project(payload["tipo_id"], item.proyecto_id)
        for field, value in payload.items():
            setattr(item, field, value)
        saved = await self.repo.save_item(item)
        return await self._respond_item(saved)

    async def delete_item(self, item_id: UUID) -> None:
        item = await self._get_active_item(item_id)
        # Borrado lógico de todo el subárbol (el nodo y sus descendientes).
        all_items = await self.repo.list_items(item.proyecto_id)
        ids = self._descendant_ids(item_id, all_items)
        await self.repo.soft_delete_many(ids)

    async def move_item(
        self, item_id: UUID, new_parent_id: UUID | None, orden: int | None
    ) -> WorkItemResponse:
        """Recoloca un nodo bajo otro padre (o a la raíz) e inserta en `orden`.

        Impide ciclos (moverse dentro de sí mismo o de un descendiente) y respeta
        las reglas de anidación del tipo de nodo. Re-secuencia a los hermanos del
        destino (y del origen si cambió de padre) a 0..n-1 para que el orden
        quede limpio y sin huecos ni empates. Las fechas efectivas se re-derivan
        solas en lectura (el motor usa el inicio del nuevo padre).
        """
        item = await self._get_active_item(item_id)
        all_items = await self.repo.list_items(item.proyecto_id)

        if new_parent_id is not None:
            if new_parent_id == item_id:
                raise ValidationError("Un nodo no puede ser su propio padre")
            parent = await self._get_active_item(new_parent_id)
            if parent.proyecto_id != item.proyecto_id:
                raise ValidationError("El nodo destino pertenece a otro proyecto")
            if new_parent_id in set(self._descendant_ids(item_id, all_items)):
                raise ValidationError(
                    "No se puede mover un nodo dentro de sí mismo o de un descendiente"
                )
            # Recolocar es deliberadamente permisivo: solo bloqueamos ciclos.
            # Ni las reglas de anidación por tipo (`tipos_hijos_permitidos`) ni
            # las fechas impiden el movimiento; que un hijo termine después que
            # su padre queda REGISTRADO y marcado como conflicto en lectura
            # (`conflicto_fechas`), no rechazado. Bloquear obligaba a arreglar
            # las fechas antes de poder reorganizar el árbol, que es justo al
            # revés de como se planifica: primero se ordena, luego se ajusta.

        old_parent_id = item.parent_id
        item.parent_id = new_parent_id

        # Hermanos del destino, EXCLUYENDO el propio nodo, ya ordenados.
        siblings = sorted(
            (i for i in all_items if i.parent_id == new_parent_id and i.id != item_id),
            key=lambda i: i.orden,
        )
        index = len(siblings) if orden is None else max(0, min(orden, len(siblings)))
        ordered = siblings[:index] + [item] + siblings[index:]
        await self._resequence(ordered)
        # El nodo movido puede caer en un índice igual a su orden previo; su
        # cambio de padre debe persistir igual, así que lo guardamos siempre.
        item.orden = index
        await self.repo.save_item(item)

        # Si cambió de padre, compacta también el orden del padre anterior.
        if old_parent_id != new_parent_id:
            old_siblings = sorted(
                (
                    i
                    for i in all_items
                    if i.parent_id == old_parent_id and i.id != item_id
                ),
                key=lambda i: i.orden,
            )
            await self._resequence(old_siblings)

        return await self._respond_item(item)

    async def _resequence(self, ordered: list[WorkItem]) -> None:
        """Asigna orden 0..n-1 a una lista ya ordenada, guardando solo los que
        cambian (evita escrituras inútiles)."""
        for index, node in enumerate(ordered):
            if node.orden != index:
                node.orden = index
                await self.repo.save_item(node)

    async def shift_subtree(
        self, item_id: UUID, offset_days: int
    ) -> tuple[WorkItemResponse, list[UUID]]:
        """Desplaza las fechas plan de todo el subárbol `offset_days` días.

        Opera sobre las fechas CRUDAS (no las derivadas) de cada nodo que las
        tenga; las que se derivan (modo "solo duración") siguen el desplazamiento
        de su padre al re-derivarse. Devuelve la respuesta del nodo raíz y los ids
        del subárbol, para que la capa de aplicación desplace también las tareas.
        """
        item = await self._get_active_item(item_id)
        all_items = await self.repo.list_items(item.proyecto_id)
        descendant_ids = self._descendant_ids(item_id, all_items)

        if offset_days != 0:
            offset = datetime.timedelta(days=offset_days)
            in_scope = set(descendant_ids)
            for node in all_items:
                if node.id not in in_scope:
                    continue
                if node.fecha_inicio_plan is not None:
                    node.fecha_inicio_plan = node.fecha_inicio_plan + offset
                if node.fecha_fin_plan is not None:
                    node.fecha_fin_plan = node.fecha_fin_plan + offset
                await self.repo.save_item(node)

        return await self._respond_item(item), descendant_ids

    async def clone_subtree(
        self, source_id: UUID, data: CloneWorkItemRequest
    ) -> WorkItemResponse:
        """Copia el subárbol que cuelga de `source_id` y lo pega bajo el destino.

        Ver `clone_subtree_with_maps`: este atajo devuelve solo la respuesta del
        primer clon (compatibilidad con el resto del código y los tests).
        """
        response, _maps = await self.clone_subtree_with_maps(source_id, data)
        return response

    async def clone_subtree_with_maps(
        self, source_id: UUID, data: CloneWorkItemRequest
    ) -> tuple[WorkItemResponse, list[dict[UUID, UUID]]]:
        """Clona el subárbol `data.times` veces y devuelve el mapa old→new de cada
        pegada.

        Replica con nuevos UUIDs preservando la jerarquía interna, desplaza las
        fechas plan (`offset_days`), resetea fechas reales y avance, y preserva
        SOLO las dependencias FtS internas al subárbol (las externas se
        descartan). El nodo raíz puede recibir un nombre nuevo opcional.

        Devuelve `(respuesta_del_primer_clon, [mapa_por_pegada])`. Los mapas
        permiten a la capa de aplicación copiar las tareas del subárbol
        redirigiéndolas a los nuevos elementos.
        """
        source = await self._get_active_item(source_id)
        proyecto_id = source.proyecto_id

        # Validar destino: si se da, debe estar vivo y en el mismo proyecto, y
        # NO puede pertenecer al subárbol que se clona (evita pegar dentro de sí
        # mismo, lo que crearía un ciclo de descendencia).
        target_parent: WorkItem | None = None
        if data.target_parent_id is not None:
            target_parent = await self._get_active_item(data.target_parent_id)
            if target_parent.proyecto_id != proyecto_id:
                raise ValidationError("El nodo destino pertenece a otro proyecto")

        all_items = await self.repo.list_items(proyecto_id)
        descendant_ids = set(self._descendant_ids(source_id, all_items))

        if target_parent is not None and target_parent.id in descendant_ids:
            raise ValidationError("No se puede pegar el subárbol dentro de sí mismo")

        # Snapshot del origen: se clona SIEMPRE desde el original, no desde una
        # pegada previa, aunque se pegue varias veces.
        items_by_id = {item.id: item for item in all_items if item.id in descendant_ids}
        offset = datetime.timedelta(days=data.offset_days)
        edges = await self.repo.list_dependency_edges(proyecto_id)
        internal_edges = [
            (s, p) for s, p in edges if s in descendant_ids and p in descendant_ids
        ]

        base_orden = await self.repo.next_orden(proyecto_id, data.target_parent_id)
        maps: list[dict[UUID, UUID]] = []
        first_root: WorkItem | None = None

        for paste_index in range(data.times):
            rename_to = self._paste_root_name(
                base_name=data.rename_root_to,
                paste_index=paste_index,
                times=data.times,
            )
            new_id_by_old, clone_root = await self._clone_once(
                source_id=source_id,
                target_parent_id=data.target_parent_id,
                items_by_id=items_by_id,
                offset=offset,
                root_orden=base_orden + paste_index,
                rename_root_to=rename_to,
            )

            # Copiar dependencias FtS *internas* al subárbol para esta pegada.
            for successor, predecessor in internal_edges:
                await self.repo.add_dependency(
                    WorkItemDependency(
                        work_item_id=new_id_by_old[successor],
                        depends_on_id=new_id_by_old[predecessor],
                    )
                )

            maps.append(new_id_by_old)
            if first_root is None:
                first_root = clone_root

        assert first_root is not None
        return await self._respond_item(first_root), maps

    @staticmethod
    def _paste_root_name(
        *, base_name: str | None, paste_index: int, times: int
    ) -> str | None:
        """Nombre del nodo raíz de una pegada. Con varias copias se numera para
        distinguirlas ("Curso 1", "Curso 2", …). Con una sola, respeta el nombre
        pedido (o `None` = conserva el del origen)."""
        if times <= 1:
            return base_name or None
        prefix = base_name if base_name else None
        # Si no hay nombre base, el llamador dejará que _make_clone use el del
        # origen; para numerar necesitamos un texto, así que se resuelve fuera.
        return f"{prefix} {paste_index + 1}" if prefix else None

    async def _clone_once(
        self,
        *,
        source_id: UUID,
        target_parent_id: UUID | None,
        items_by_id: dict[UUID, WorkItem],
        offset: datetime.timedelta,
        root_orden: int,
        rename_root_to: str | None,
    ) -> tuple[dict[UUID, UUID], WorkItem]:
        """Clona una vez el subárbol en BFS (padre antes que hijo) y devuelve el
        mapa old→new y el nodo raíz clonado."""
        new_id_by_old: dict[UUID, UUID] = {}
        queue: list[tuple[UUID, UUID | None, int]] = [
            (source_id, target_parent_id, root_orden)
        ]
        clone_root: WorkItem | None = None

        while queue:
            old_id, new_parent_id, orden = queue.pop(0)
            original = items_by_id[old_id]
            clone = self._make_clone(
                original=original,
                parent_id=new_parent_id,
                orden=orden,
                offset=offset,
                rename_to=(rename_root_to if old_id == source_id else None),
            )
            saved = await self.repo.add_item(clone)
            new_id_by_old[old_id] = saved.id
            if old_id == source_id:
                clone_root = saved
            children = sorted(
                (i for i in items_by_id.values() if i.parent_id == old_id),
                key=lambda c: c.orden,
            )
            for index, child in enumerate(children):
                queue.append((child.id, saved.id, index))

        assert clone_root is not None
        return new_id_by_old, clone_root

    @staticmethod
    def _make_clone(
        *,
        original: WorkItem,
        parent_id: UUID | None,
        orden: int,
        offset: datetime.timedelta,
        rename_to: str | None,
    ) -> WorkItem:
        """Construye un WorkItem clon: nuevas fechas desplazadas, avance reseteado."""

        def shift(d: datetime.date | None) -> datetime.date | None:
            return d + offset if d is not None else None

        return WorkItem(
            proyecto_id=original.proyecto_id,
            parent_id=parent_id,
            tipo_id=original.tipo_id,
            nombre=rename_to or original.nombre,
            orden=orden,
            prioridad=original.prioridad,
            fecha_inicio_plan=shift(original.fecha_inicio_plan),
            fecha_fin_plan=shift(original.fecha_fin_plan),
            duracion_valor=original.duracion_valor,
            duracion_unidad=original.duracion_unidad,
            # Reseteados deliberadamente (spec §9): el clon empieza "en limpio".
            fecha_inicio_real=None,
            fecha_fin_real=None,
            porcentaje_completado=None,
            es_transversal=original.es_transversal,
        )

    async def get_item(self, item_id: UUID) -> WorkItemResponse:
        item = await self._get_active_item(item_id)
        return await self._respond_item(item)

    async def get_tree(self, proyecto_id: UUID) -> list[WorkItemTreeResponse]:
        items, derivation = await self._project_derivation(proyecto_id)
        return self._build_tree(items, derivation)

    # ── Dependencias Finish-to-Start ──────────────────────────────────────────
    async def add_dependency(
        self, work_item_id: UUID, depends_on_id: UUID
    ) -> WorkItemDependencyResponse:
        if work_item_id == depends_on_id:
            raise ValidationError("Un nodo no puede depender de sí mismo")

        successor = await self._get_active_item(work_item_id)
        predecessor = await self._get_active_item(depends_on_id)
        if successor.proyecto_id != predecessor.proyecto_id:
            raise ValidationError("Las dependencias deben ser del mismo proyecto")

        if await self.repo.get_dependency(work_item_id, depends_on_id) is not None:
            raise ConflictError("La dependencia ya existe")

        edges = await self.repo.list_dependency_edges(successor.proyecto_id)
        if self._creates_cycle(edges, work_item_id, depends_on_id):
            raise ValidationError("La dependencia crearía un ciclo")

        dependency = await self.repo.add_dependency(
            WorkItemDependency(work_item_id=work_item_id, depends_on_id=depends_on_id)
        )

        # Con la nueva arista, validamos FtS sobre las fechas derivadas.
        _, derivation = await self._project_derivation(successor.proyecto_id)
        succ_inicio = derivation[work_item_id].fecha_inicio_plan
        pred_fin = derivation[depends_on_id].fecha_fin_plan
        if viola_fts(succ_inicio, pred_fin):
            raise ValidationError(
                "El nodo no puede iniciar antes de que termine su predecesor (FtS)"
            )

        return WorkItemDependencyResponse(
            id=dependency.id,
            work_item_id=dependency.work_item_id,
            depends_on_id=dependency.depends_on_id,
        )

    async def remove_dependency(self, work_item_id: UUID, depends_on_id: UUID) -> None:
        dependency = await self.repo.get_dependency(work_item_id, depends_on_id)
        if dependency is None:
            raise NotFoundError("La dependencia no existe")
        await self.repo.delete_dependency(dependency)

    async def list_dependencies(
        self, work_item_id: UUID
    ) -> list[WorkItemDependencyResponse]:
        await self._get_active_item(work_item_id)
        deps = await self.repo.list_dependencies(work_item_id)
        return [
            WorkItemDependencyResponse(
                id=d.id, work_item_id=d.work_item_id, depends_on_id=d.depends_on_id
            )
            for d in deps
        ]

    # ── Derivación de fechas (en lectura) ─────────────────────────────────────
    async def _respond_item(self, item: WorkItem) -> WorkItemResponse:
        items, derivation = await self._project_derivation(item.proyecto_id)
        derived = derivation.get(
            item.id,
            DerivedDates(item.fecha_inicio_plan, item.fecha_fin_plan, False),
        )
        conflicts = self._compute_date_conflicts(items, derivation)
        return self._to_item_response(item, derived, item.id in conflicts)

    async def _project_derivation(
        self, proyecto_id: UUID
    ) -> tuple[list[WorkItem], dict[UUID, DerivedDates]]:
        items = await self.repo.list_items(proyecto_id)
        edges = await self.repo.list_dependency_edges(proyecto_id)
        return items, self._compute_derivation(items, edges)

    @staticmethod
    def _compute_derivation(
        items: list[WorkItem], edges: list[tuple[UUID, UUID]]
    ) -> dict[UUID, DerivedDates]:
        """Deriva las fechas efectivas de cada nodo propagando el motor.

        Un nodo se posiciona a partir del fin (derivado) de sus predecesores FtS
        o, en su defecto, del inicio (derivado) de su padre. Memoizado y con
        guardia anti-recursión (los ciclos ya están prohibidos al crear aristas).
        """
        items_by_id = {item.id: item for item in items}
        predecessors: dict[UUID, list[UUID]] = {}
        for successor, predecessor in edges:
            if successor in items_by_id and predecessor in items_by_id:
                predecessors.setdefault(successor, []).append(predecessor)

        memo: dict[UUID, DerivedDates] = {}
        visiting: set[UUID] = set()

        def derive(node_id: UUID) -> DerivedDates:
            if node_id in memo:
                return memo[node_id]
            item = items_by_id.get(node_id)
            if item is None:
                return DerivedDates(None, None, False)
            if node_id in visiting:
                return DerivedDates(item.fecha_inicio_plan, item.fecha_fin_plan, False)
            visiting.add(node_id)

            parent_start = None
            if item.parent_id is not None and item.parent_id in items_by_id:
                parent_start = derive(item.parent_id).fecha_inicio_plan

            ends = [
                derive(pred).fecha_fin_plan for pred in predecessors.get(node_id, [])
            ]
            valid_ends = [end for end in ends if end is not None]
            predecessor_end = max(valid_ends) if valid_ends else None

            result = derive_dates(
                fecha_inicio_plan=item.fecha_inicio_plan,
                fecha_fin_plan=item.fecha_fin_plan,
                duracion_valor=item.duracion_valor,
                duracion_unidad=item.duracion_unidad,
                predecessor_end=predecessor_end,
                parent_start=parent_start,
            )
            visiting.discard(node_id)
            memo[node_id] = result
            return result

        for item in items:
            derive(item.id)
        return memo

    # ── Helpers ───────────────────────────────────────────────────────────────
    async def _get_active_tipo(self, tipo_id: UUID) -> TipoNodo:
        tipo = await self.repo.get_tipo(tipo_id)
        if tipo is None or tipo.is_deleted:
            raise NotFoundError("Tipo de nodo no encontrado")
        return tipo

    async def _get_active_item(self, item_id: UUID) -> WorkItem:
        item = await self.repo.get_item(item_id)
        if item is None or item.is_deleted:
            raise NotFoundError("Nodo de trabajo no encontrado")
        return item

    async def _get_valid_tipo_for_project(
        self, tipo_id: UUID, proyecto_id: UUID
    ) -> TipoNodo:
        tipo = await self._get_active_tipo(tipo_id)
        # Un tipo global (proyecto_id null) sirve a cualquier proyecto; uno de
        # proyecto solo sirve al suyo.
        if tipo.proyecto_id is not None and tipo.proyecto_id != proyecto_id:
            raise ValidationError("El tipo de nodo pertenece a otro proyecto")
        return tipo

    @staticmethod
    def _compute_date_conflicts(
        items: list[WorkItem], derivation: dict[UUID, DerivedDates]
    ) -> set[UUID]:
        """Ids de los nodos que terminan después que su padre.

        Se calcula en LECTURA sobre las fechas derivadas (las efectivas, no las
        que se escribieron), por dos motivos: un nodo en modo "solo duración"
        no tiene fin propio y solo se sabe dónde acaba tras derivarlo, y así el
        conflicto aparece venga de donde venga —recolocar el hijo, recortar el
        padre o cambiar una duración— y no solo del drag & drop.
        """
        items_by_id = {item.id: item for item in items}
        conflicts: set[UUID] = set()
        for item in items:
            if item.parent_id is None or item.parent_id not in items_by_id:
                continue
            fin = derivation[item.id].fecha_fin_plan
            fin_padre = derivation[item.parent_id].fecha_fin_plan
            if fin is not None and fin_padre is not None and fin > fin_padre:
                conflicts.add(item.id)
        return conflicts

    @staticmethod
    def _validate_nesting(parent: WorkItem, child_tipo: TipoNodo) -> None:
        reglas = parent.tipo.reglas_anidacion if parent.tipo else None
        if not reglas:
            return
        permitidos = reglas.get("tipos_hijos_permitidos")
        if permitidos and str(child_tipo.id) not in {str(t) for t in permitidos}:
            raise ValidationError(
                f"Un nodo de tipo «{parent.tipo.nombre}» no admite hijos de tipo "
                f"«{child_tipo.nombre}»"
            )

    @staticmethod
    def _descendant_ids(root_id: UUID, items: list[WorkItem]) -> list[UUID]:
        children: dict[UUID, list[UUID]] = {}
        for item in items:
            if item.parent_id is not None:
                children.setdefault(item.parent_id, []).append(item.id)
        collected = [root_id]
        stack = [root_id]
        while stack:
            current = stack.pop()
            for child_id in children.get(current, []):
                collected.append(child_id)
                stack.append(child_id)
        return collected

    @staticmethod
    def _creates_cycle(
        edges: list[tuple[UUID, UUID]], work_item_id: UUID, depends_on_id: UUID
    ) -> bool:
        # edges = (sucesor, predecesor). Agregar (work_item → depends_on) cierra
        # un ciclo si depends_on ya depende (transitivamente) de work_item.
        adjacency: dict[UUID, list[UUID]] = {}
        for successor, predecessor in edges:
            adjacency.setdefault(successor, []).append(predecessor)
        stack = [depends_on_id]
        seen: set[UUID] = set()
        while stack:
            current = stack.pop()
            if current == work_item_id:
                return True
            if current in seen:
                continue
            seen.add(current)
            stack.extend(adjacency.get(current, []))
        return False

    def _build_tree(
        self, items: list[WorkItem], derivation: dict[UUID, DerivedDates]
    ) -> list[WorkItemTreeResponse]:
        conflicts = self._compute_date_conflicts(items, derivation)
        nodes = {
            item.id: self._to_tree_response(
                item, derivation[item.id], item.id in conflicts
            )
            for item in items
        }
        roots: list[WorkItemTreeResponse] = []
        for item in items:
            node = nodes[item.id]
            parent = nodes.get(item.parent_id) if item.parent_id else None
            if parent is not None:
                parent.children.append(node)
            else:
                roots.append(node)
        return roots

    @staticmethod
    def _to_tipo_response(tipo: TipoNodo) -> TipoNodoResponse:
        return TipoNodoResponse(
            id=tipo.id,
            proyecto_id=tipo.proyecto_id,
            nombre=tipo.nombre,
            color=tipo.color,
            icono=tipo.icono,
            reglas_anidacion=tipo.reglas_anidacion,
        )

    @staticmethod
    def _item_fields(item: WorkItem, derived: DerivedDates) -> dict:
        return {
            "id": item.id,
            "proyecto_id": item.proyecto_id,
            "parent_id": item.parent_id,
            "tipo_id": item.tipo_id,
            "nombre": item.nombre,
            "orden": item.orden,
            "prioridad": item.prioridad,
            # Fechas EFECTIVAS (derivadas), no las entradas crudas.
            "fecha_inicio_plan": derived.fecha_inicio_plan,
            "fecha_fin_plan": derived.fecha_fin_plan,
            "duracion_valor": item.duracion_valor,
            "duracion_unidad": item.duracion_unidad,
            "fecha_inicio_real": item.fecha_inicio_real,
            "fecha_fin_real": item.fecha_fin_real,
            "porcentaje_completado": (
                float(item.porcentaje_completado)
                if item.porcentaje_completado is not None
                else None
            ),
            "es_transversal": item.es_transversal,
        }

    def _to_item_response(
        self, item: WorkItem, derived: DerivedDates, conflicto: bool = False
    ) -> WorkItemResponse:
        return WorkItemResponse(
            **self._item_fields(item, derived),
            advertencia_fechas=derived.advertencia,
            conflicto_fechas=conflicto,
        )

    def _to_tree_response(
        self, item: WorkItem, derived: DerivedDates, conflicto: bool = False
    ) -> WorkItemTreeResponse:
        return WorkItemTreeResponse(
            **self._item_fields(item, derived),
            advertencia_fechas=derived.advertencia,
            conflicto_fechas=conflicto,
            children=[],
        )
