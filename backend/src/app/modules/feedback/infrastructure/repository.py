from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.feedback.domain.repository import FeedbackRepository
from app.modules.feedback.infrastructure.models import Feedback


class SqlAlchemyFeedbackRepository(FeedbackRepository):
    """Implementación concreta del contrato FeedbackRepository con SQLAlchemy."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, feedback: Feedback) -> Feedback:
        self._session.add(feedback)
        await self._session.flush()
        await self._session.refresh(feedback)
        return feedback

    async def list(self, limit: int, offset: int) -> tuple[list[Feedback], int]:
        total = await self._session.scalar(select(func.count()).select_from(Feedback))
        rows = (
            (
                await self._session.execute(
                    select(Feedback)
                    .options(selectinload(Feedback.author))
                    .order_by(Feedback.created_at.desc())
                    .limit(limit)
                    .offset(offset)
                )
            )
            .scalars()
            .all()
        )
        return list(rows), int(total or 0)
