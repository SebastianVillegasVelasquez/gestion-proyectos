"""El grafo de migraciones, comprobado sin base de datos.

Un id de revisión repetido o una cabeza de más no rompen "algún" test: rompen
TODOS los de integración a la vez, y lo hacen en el `setup` de la sesión, donde
el fallo real queda enterrado bajo un `CalledProcessError`. Estas dos
comprobaciones cuestan milisegundos, no necesitan Postgres y señalan el archivo
culpable por su nombre.
"""

import re
from collections import defaultdict
from pathlib import Path

VERSIONS_DIR = Path(__file__).resolve().parents[3] / "alembic" / "versions"

_REVISION = re.compile(r'^revision(?:\s*:\s*[^=]+)?\s*=\s*["\'](.+?)["\']', re.M)
_DOWN_REVISION = re.compile(r"^down_revision(?:\s*:\s*[^=]+)?\s*=\s*(.+)$", re.M)


def _migrations() -> dict[str, tuple[str, set[str]]]:
    """`revision -> (archivo, revisiones padre)` para cada migración."""
    found: dict[str, tuple[str, set[str]]] = {}
    duplicates: dict[str, list[str]] = defaultdict(list)

    for path in sorted(VERSIONS_DIR.glob("*.py")):
        source = path.read_text(encoding="utf-8")
        match = _REVISION.search(source)
        if match is None:
            continue
        revision = match.group(1)
        parents: set[str] = set()
        down = _DOWN_REVISION.search(source)
        if down is not None:
            # Vale tanto `= "abc"` como la tupla de una fusión `= ("a", "b")`.
            parents = set(re.findall(r'["\']([^"\']+)["\']', down.group(1)))
        if revision in found:
            duplicates[revision].extend([found[revision][0], path.name])
        found[revision] = (path.name, parents)

    assert not duplicates, (
        "Hay ids de revisión repetidos: "
        + "; ".join(
            f"{rev} en {sorted(set(files))}" for rev, files in duplicates.items()
        )
        + ". Alembic ve un ciclo y no aplica NINGUNA migración."
    )
    return found


class TestMigrationGraph:
    def test_revision_ids_are_unique(self):
        # La aserción vive dentro de `_migrations` para nombrar los archivos.
        assert _migrations()

    def test_there_is_exactly_one_head(self):
        migrations = _migrations()
        parents = {parent for _, parents in migrations.values() for parent in parents}
        heads = {
            rev: file for rev, (file, _) in migrations.items() if rev not in parents
        }
        assert len(heads) == 1, (
            f"Se esperaba una sola cabeza y hay {len(heads)}: {heads}. "
            "Con varias, `alembic upgrade head` falla con 'Multiple head "
            "revisions are present' y no aplica nada: hace falta una migración "
            "de fusión."
        )

    def test_every_parent_exists(self):
        migrations = _migrations()
        missing = {
            file: sorted(parents - migrations.keys())
            for _, (file, parents) in migrations.items()
            if parents - migrations.keys()
        }
        assert (
            not missing
        ), f"Migraciones que apuntan a una revisión inexistente: {missing}"
