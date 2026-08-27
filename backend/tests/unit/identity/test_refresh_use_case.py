from datetime import datetime, timezone
import uuid

import pytest

from app.core.security import create_access_token, create_refresh_token
from app.modules.identity.application.use_cases import RefreshTokenUseCase
from app.modules.identity.infrastructure.enums import SystemRole, UserPosition
from app.shared.exceptions import UnauthorizedError


class FakeUser:
    def __init__(self, user_id, is_active=True):
        self.id = user_id
        self.email = "user@test.com"
        self.name = "Test"
        self.last_name = "User"
        self.role = SystemRole.ADMIN
        self.position = UserPosition.SIN_CARGO
        self.is_active = is_active
        self.document_type = None
        self.document_number = None
        self.created_at = datetime.now(timezone.utc)


class FakeUserRepo:
    def __init__(self, user: FakeUser | None):
        self._user = user

    async def get_by_id(self, user_id):
        if self._user and self._user.id == user_id:
            return self._user
        return None


class TestRefreshTokenUseCase:
    async def test_should_issue_tokens_for_valid_refresh(self):
        user_id = uuid.uuid4()
        repo = FakeUserRepo(FakeUser(user_id))
        token = create_refresh_token(user_id)

        result = await RefreshTokenUseCase(repo).execute(token)

        assert result.access_token
        assert result.refresh_token
        assert result.user.id == user_id

    async def test_should_reject_access_token(self):
        user_id = uuid.uuid4()
        repo = FakeUserRepo(FakeUser(user_id))
        access = create_access_token(user_id, SystemRole.ADMIN.value)

        with pytest.raises(UnauthorizedError):
            await RefreshTokenUseCase(repo).execute(access)

    async def test_should_reject_garbage_token(self):
        repo = FakeUserRepo(None)
        with pytest.raises(UnauthorizedError):
            await RefreshTokenUseCase(repo).execute("garbage.token.value")

    async def test_should_reject_when_user_inactive(self):
        user_id = uuid.uuid4()
        repo = FakeUserRepo(FakeUser(user_id, is_active=False))
        token = create_refresh_token(user_id)

        with pytest.raises(UnauthorizedError):
            await RefreshTokenUseCase(repo).execute(token)
