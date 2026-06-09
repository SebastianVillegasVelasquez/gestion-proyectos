from app.modules.project.infrastructure.models import Project
from app.shared.base_repository import BaseRepository


class ProjectRepository(BaseRepository[Project]):
    def __init__(self, session):
        super().__init__(session=session, model=Project)


class ProjectNodeRepository(BaseRepository[Project]):
    def __init__(self, session):
        super().__init__(session=session, model=Project)
