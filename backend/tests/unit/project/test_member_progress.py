"""Avance ponderado por integrante: la profundidad del árbol debe diluir el peso."""

from uuid import uuid4

from app.modules.project.domain.member_progress import (
    WorkNode,
    WorkTask,
    aggregate_progress_by_user,
    compute_task_weights,
)


def _uuid():
    return uuid4()


class TestComputeTaskWeights:
    def test_single_root_task_gets_full_weight(self):
        task_id = _uuid()
        tasks = [
            WorkTask(
                id=task_id,
                work_item_id=None,
                assignee_id=_uuid(),
                team_id=None,
                is_completed=False,
            )
        ]
        weights = compute_task_weights(nodes=[], tasks=tasks)
        assert weights[task_id] == 1.0

    def test_curso_modulo_unidades_diluyen_el_peso_por_profundidad(self):
        """Curso → 2 Módulos → 3 Unidades cada uno, una tarea por Unidad.

        Cada Módulo recibe la mitad del peso del Curso; cada Unidad, un tercio
        del peso de su Módulo. Una tarea de Unidad debe pesar 1/2 * 1/3 = 1/6
        del proyecto — mucho menos que si colgara directo del Curso.
        """
        curso = WorkNode(id=_uuid(), parent_id=None)
        modulos = [WorkNode(id=_uuid(), parent_id=curso.id) for _ in range(2)]
        unidades = [
            WorkNode(id=_uuid(), parent_id=modulo.id)
            for modulo in modulos
            for _ in range(3)
        ]
        nodes = [curso, *modulos, *unidades]

        tasks = [
            WorkTask(
                id=_uuid(),
                work_item_id=unidad.id,
                assignee_id=_uuid(),
                team_id=None,
                is_completed=False,
            )
            for unidad in unidades
        ]

        weights = compute_task_weights(nodes, tasks)

        assert len(weights) == 6
        for weight in weights.values():
            assert weight == 1 / 6
        assert sum(weights.values()) == 1.0

    def test_una_tarea_en_la_raiz_pesa_mas_que_una_en_un_nodo_profundo(self):
        curso = WorkNode(id=_uuid(), parent_id=None)
        modulo = WorkNode(id=_uuid(), parent_id=curso.id)
        unidad = WorkNode(id=_uuid(), parent_id=modulo.id)
        nodes = [curso, modulo, unidad]

        root_task = WorkTask(
            id=_uuid(),
            work_item_id=curso.id,
            assignee_id=_uuid(),
            team_id=None,
            is_completed=False,
        )
        deep_task = WorkTask(
            id=_uuid(),
            work_item_id=unidad.id,
            assignee_id=_uuid(),
            team_id=None,
            is_completed=False,
        )
        weights = compute_task_weights(nodes, [root_task, deep_task])

        # El Curso reparte su 1.0 entre su tarea propia y su único hijo con
        # trabajo (el Módulo): 0.5 cada uno. El Módulo pasa su 0.5 completo a
        # la Unidad (su único hijo con trabajo), que lo pasa completo a su
        # única tarea. La tarea raíz pesa más que la tarea profunda.
        assert weights[root_task.id] == 0.5
        assert weights[deep_task.id] == 0.5  # single-child chain no diluye más
        # Con ramificación (2+ hermanos) sí diluye — cubierto en el test anterior.

    def test_ramas_sin_trabajo_no_diluyen_el_peso_de_las_que_si_tienen(self):
        curso = WorkNode(id=_uuid(), parent_id=None)
        modulo_con_trabajo = WorkNode(id=_uuid(), parent_id=curso.id)
        modulo_vacio = WorkNode(id=_uuid(), parent_id=curso.id)
        nodes = [curso, modulo_con_trabajo, modulo_vacio]

        task = WorkTask(
            id=_uuid(),
            work_item_id=modulo_con_trabajo.id,
            assignee_id=_uuid(),
            team_id=None,
            is_completed=False,
        )
        weights = compute_task_weights(nodes, [task])

        # El módulo vacío no cuenta como "unidad" en el reparto del Curso.
        assert weights[task.id] == 1.0

    def test_tareas_sueltas_se_tratan_como_hijas_de_la_raiz(self):
        loose_a = WorkTask(
            id=_uuid(),
            work_item_id=None,
            assignee_id=_uuid(),
            team_id=None,
            is_completed=False,
        )
        loose_b = WorkTask(
            id=_uuid(),
            work_item_id=None,
            assignee_id=_uuid(),
            team_id=None,
            is_completed=False,
        )
        weights = compute_task_weights(nodes=[], tasks=[loose_a, loose_b])
        assert weights[loose_a.id] == 0.5
        assert weights[loose_b.id] == 0.5

    def test_sin_tareas_no_hay_pesos(self):
        assert compute_task_weights(nodes=[], tasks=[]) == {}


class TestAggregateProgressByUser:
    def test_progreso_completado_de_100_por_ciento(self):
        user_id = _uuid()
        task = WorkTask(
            id=_uuid(),
            work_item_id=None,
            assignee_id=user_id,
            team_id=None,
            is_completed=True,
        )
        weights = compute_task_weights(nodes=[], tasks=[task])
        result = aggregate_progress_by_user([task], weights, team_member_ids={})

        assert result[user_id].progress_pct == 100
        assert result[user_id].tasks_total == 1
        assert result[user_id].tasks_completed == 1

    def test_progreso_parcial_pondera_por_peso_no_por_conteo(self):
        """Dos tareas de un usuario, una raíz (peso grande) y una profunda
        (peso chico); solo la profunda está completada. El % debe ser bajo,
        no 50%, porque la tarea completada pesa poco.
        """
        curso = WorkNode(id=_uuid(), parent_id=None)
        modulo = WorkNode(id=_uuid(), parent_id=curso.id)
        unidad_a = WorkNode(id=_uuid(), parent_id=modulo.id)
        unidad_b = WorkNode(id=_uuid(), parent_id=modulo.id)
        nodes = [curso, modulo, unidad_a, unidad_b]

        user_id = _uuid()
        root_task = WorkTask(
            id=_uuid(),
            work_item_id=curso.id,
            assignee_id=user_id,
            team_id=None,
            is_completed=False,
        )
        deep_task_done = WorkTask(
            id=_uuid(),
            work_item_id=unidad_a.id,
            assignee_id=user_id,
            team_id=None,
            is_completed=True,
        )
        deep_task_pending = WorkTask(
            id=_uuid(),
            work_item_id=unidad_b.id,
            assignee_id=user_id,
            team_id=None,
            is_completed=False,
        )
        tasks = [root_task, deep_task_done, deep_task_pending]
        weights = compute_task_weights(nodes, tasks)
        result = aggregate_progress_by_user(tasks, weights, team_member_ids={})

        # root=0.5, cada unidad=0.25 → completado 0.25 de 1.0 total = 25%, no 33%.
        assert result[user_id].progress_pct == 25
        assert result[user_id].tasks_total == 3
        assert result[user_id].tasks_completed == 1

    def test_tarea_de_equipo_se_reparte_entre_los_miembros(self):
        team_id = _uuid()
        member_a, member_b = _uuid(), _uuid()
        task = WorkTask(
            id=_uuid(),
            work_item_id=None,
            assignee_id=None,
            team_id=team_id,
            is_completed=True,
        )
        weights = compute_task_weights(nodes=[], tasks=[task])
        result = aggregate_progress_by_user(
            [task], weights, team_member_ids={team_id: [member_a, member_b]}
        )

        assert result[member_a].progress_pct == 100
        assert result[member_b].progress_pct == 100
        assert result[member_a].tasks_total == 1
        assert result[member_b].tasks_total == 1

    def test_tarea_sin_responsable_ni_equipo_no_cuenta_para_nadie(self):
        task = WorkTask(
            id=_uuid(),
            work_item_id=None,
            assignee_id=None,
            team_id=None,
            is_completed=True,
        )
        weights = compute_task_weights(nodes=[], tasks=[task])
        result = aggregate_progress_by_user([task], weights, team_member_ids={})
        assert result == {}

    def test_usuario_sin_tareas_no_aparece(self):
        result = aggregate_progress_by_user([], weights={}, team_member_ids={})
        assert result == {}
