"""Utilidades de grafos compartidas entre bounded contexts.

Las dependencias Finish-to-Start (entre tareas y entre elementos de la
estructura) son un DAG: agregar una arista no debe cerrar un ciclo. La
comprobación es la misma en ambos contextos, así que vive aquí.
"""

from collections.abc import Hashable, Iterable


def would_create_cycle(
    edges: Iterable[tuple[Hashable, Hashable]],
    new_from: Hashable,
    new_to: Hashable,
) -> bool:
    """¿Agregar la arista `new_from -> new_to` cerraría un ciclo?

    `edges` son las aristas ya existentes como `(origen, destino)` donde "origen
    depende de destino". La nueva arista cierra un ciclo si `new_to` ya alcanza
    (transitivamente, siguiendo las dependencias) a `new_from`.

    Recorrido en profundidad desde `new_to`; si llega a `new_from`, hay ciclo.
    """
    adjacency: dict[Hashable, list[Hashable]] = {}
    for origin, target in edges:
        adjacency.setdefault(origin, []).append(target)

    stack = [new_to]
    seen: set[Hashable] = set()
    while stack:
        current = stack.pop()
        if current == new_from:
            return True
        if current in seen:
            continue
        seen.add(current)
        stack.extend(adjacency.get(current, []))
    return False
