from app.modules.tasks.infrastructure.models import Task
from app.shared.base_repository import BaseRepository


class TaskRepository(BaseRepository[Task]):
    def __init__(self, session):
        super().__init__(session=session, model=Task)
