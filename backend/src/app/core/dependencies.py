from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.shared.base_repository import UserRepository


def repo_dependency(db: AsyncSession = Depends(get_db)):
    return UserRepository(db)
