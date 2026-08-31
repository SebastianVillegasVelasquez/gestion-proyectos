"""`BaseRepository.patch`: un PATCH que omite un campo no lo toca, pero un
`null` deliberado en un campo declarado `nullable` sí lo deja en blanco.

Regresión: antes `patch` ignoraba TODO valor `None`, así que quitarle el
responsable o una fecha a una tarea desde el modal de edición no tenía efecto
(el backend respondía 200 sin cambiar nada).
"""

import pytest

from app.shared.base_repository import BaseRepository


class _Row:
    def __init__(self, **kwargs) -> None:
        for k, v in kwargs.items():
            setattr(self, k, v)


class _FakeRepo(BaseRepository[_Row]):
    """Repo sin sesión: `save` devuelve la entidad tal cual."""

    def __init__(self) -> None:  # noqa: D401 - sin super().__init__ a propósito
        pass

    async def save(self, entity):
        return entity


@pytest.mark.asyncio
class TestPatchNullableFields:
    async def test_omitted_field_is_untouched(self):
        row = _Row(title="A", assignee_id="u1", start_date="2026-01-01")
        await _FakeRepo().patch(row, {"title": "B"})
        assert row.title == "B"
        assert row.assignee_id == "u1"
        assert row.start_date == "2026-01-01"

    async def test_none_is_ignored_by_default(self):
        row = _Row(assignee_id="u1")
        await _FakeRepo().patch(row, {"assignee_id": None})
        assert row.assignee_id == "u1"

    async def test_none_clears_a_declared_nullable_field(self):
        row = _Row(assignee_id="u1", start_date="2026-01-01", due_date="2026-02-01")
        await _FakeRepo().patch(
            row,
            {"assignee_id": None, "start_date": None},
            nullable_fields={"assignee_id", "start_date", "due_date"},
        )
        assert row.assignee_id is None
        assert row.start_date is None
        # No enviado en el dict → intacto aunque esté en nullable_fields.
        assert row.due_date == "2026-02-01"

    async def test_non_null_values_still_apply_with_nullable_set(self):
        row = _Row(title="A", assignee_id="u1")
        await _FakeRepo().patch(
            row, {"title": "B", "assignee_id": "u2"}, nullable_fields={"assignee_id"}
        )
        assert row.title == "B"
        assert row.assignee_id == "u2"
