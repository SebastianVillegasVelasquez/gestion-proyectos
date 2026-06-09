import uuid
from copy import deepcopy
from typing import TypeVar, Any, List, Optional, Dict
from uuid import UUID

import pytest

from app.modules.project.infrastructure.models import Project
from app.shared.base_repository import Repository

T = TypeVar("T")


class FakeRepository(Repository[T]):
    def __init__(self, model_cls: type[T]) -> None:
        self.model_cls = model_cls
        self._storage: Dict[UUID, T] = {}

    async def get_by_id(self, entity_id: UUID) -> Optional[T]:
        entity = self._storage.get(entity_id)
        if not entity:
            return None
        return deepcopy(entity)

    async def get_all(self) -> List[T]:
        return [deepcopy(entity) for entity in self._storage.values()]

    async def save(self, entity: T) -> T:
        current_id = getattr(entity, "id", None)

        if current_id is None:
            entity.id = uuid.uuid4()

        self._storage[entity.id] = deepcopy(entity)
        return entity

    async def add(self, entity: T) -> T:
        return await self.save(entity)

    async def update(self, entity: T) -> T:
        return await self.save(entity)

    async def patch(self, entity: T, data: dict[str, Any]) -> T:
        for field, value in data.items():
            if value is not None:
                setattr(entity, field, value)
        return await self.save(entity)


@pytest.fixture
def fake_project_repository() -> FakeRepository[Project]:
    return FakeRepository(model_cls=Project)
