"""Selección de elementos de una rama para la carga masiva de tareas.

Lógica pura (sin BD): decide QUÉ elementos de la rama se convierten en tarea.
El resto del caso de uso (crear cada tarea, saltar las que ya existen) se prueba
contra la API en tests/integration/tasks.
"""

import uuid
from types import SimpleNamespace

from app.modules.tasks.application.use_cases import _find_branch, _flatten_branch


def _node(nombre, children=(), orden=0):
    return SimpleNamespace(
        id=uuid.uuid4(), nombre=nombre, orden=orden, children=list(children)
    )


def _branch():
    """Unidad 1 ─ Video (Guion, Grabación) ─ Quiz."""
    guion = _node("Guion", orden=0)
    grabacion = _node("Grabación", orden=1)
    video = _node("Video", [guion, grabacion], orden=0)
    quiz = _node("Quiz", orden=1)
    return _node("Unidad 1", [video, quiz])


class TestFindBranch:
    def test_finds_a_nested_element(self):
        root = _branch()
        target = root.children[0].children[1]
        assert _find_branch([root], target.id) is target

    def test_returns_none_when_absent(self):
        assert _find_branch([_branch()], uuid.uuid4()) is None


class TestFlattenBranch:
    def test_only_leaves_skips_the_containers(self):
        """Lo que alguien produce son las piezas; "Unidad 1" y "Video" son
        agrupadores y no deberían generar tarea."""
        names = [n.nombre for n in _flatten_branch(_branch(), only_leaves=True)]
        assert sorted(names) == ["Grabación", "Guion", "Quiz"]

    def test_all_elements_includes_containers_and_the_root(self):
        names = [n.nombre for n in _flatten_branch(_branch(), only_leaves=False)]
        assert sorted(names) == [
            "Grabación",
            "Guion",
            "Quiz",
            "Unidad 1",
            "Video",
        ]

    def test_a_leaf_root_is_itself_a_candidate(self):
        """Lanzarlo sobre un elemento suelto crea su tarea, no cero tareas."""
        solo = _node("Pieza suelta")
        assert [n.nombre for n in _flatten_branch(solo, only_leaves=True)] == [
            "Pieza suelta"
        ]

    def test_orders_by_the_tree_reading_order(self):
        """Profundidad primero, respetando `orden` dentro de cada nivel: las
        tareas se crean en el mismo orden en que se lee el árbol."""
        names = [n.nombre for n in _flatten_branch(_branch(), only_leaves=False)]
        assert names == ["Unidad 1", "Video", "Guion", "Grabación", "Quiz"]
