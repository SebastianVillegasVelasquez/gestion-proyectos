"""Tests unitarios del contexto de equipos.

Demuestran la Inversión de Dependencias (D de SOLID): las use cases y el
servicio dependen de la abstracción `TeamRepository`, así que aquí inyectamos
un fake en memoria y verificamos el comportamiento esperado sin tocar la base
de datos ni SQLAlchemy.
"""

import uuid
from types import SimpleNamespace

import pytest

from app.modules.identity.infrastructure.enums import UserPosition
from app.modules.teams.application.use_cases import (
    AddTeamMemberUseCase,
    ChangeTeamMemberRoleUseCase,
    CreateTeamUseCase,
    DeleteTeamUseCase,
    GetTeamUseCase,
    ListTeamMembersUseCase,
    ListTeamsUseCase,
    RemoveTeamMemberUseCase,
    UpdateTeamUseCase,
)
from app.modules.teams.domain.repository import TeamRepository
from app.modules.teams.infrastructure.enums import TeamRole
from app.modules.teams.infrastructure.models import Team, TeamMember
from app.modules.teams.presentation.schemas import (
    CreateTeamRequest,
    UpdateTeamRequest,
)
from app.shared.exceptions import ConflictError, NotFoundError
from app.shared.pagination import Pagination


class FakeTeamRepository(TeamRepository):
    """Implementación en memoria del contrato del dominio (sin SQLAlchemy)."""

    def __init__(self) -> None:
        self._teams: dict[uuid.UUID, Team] = {}
        self._members: dict[tuple[uuid.UUID, uuid.UUID], TeamMember] = {}
        # Directorio de usuarios para reconstruir la respuesta (datos del usuario).
        self.users: dict[uuid.UUID, SimpleNamespace] = {}

    async def add_team(self, team: Team) -> Team:
        if team.id is None:
            team.id = uuid.uuid4()
        self._teams[team.id] = team
        return team

    async def save_team(self, team: Team) -> Team:
        self._teams[team.id] = team
        return team

    async def get_team(self, team_id):
        return self._teams.get(team_id)

    async def get_team_by_name(self, name):
        for team in self._teams.values():
            if team.name == name and not team.is_deleted:
                return team
        return None

    async def search_teams(self, search, limit, offset):
        teams = [t for t in self._teams.values() if not t.is_deleted]
        if search:
            teams = [t for t in teams if search.lower() in t.name.lower()]
        total = len(teams)
        return teams[offset : offset + limit], total

    async def add_member(self, member: TeamMember) -> TeamMember:
        if member.id is None:
            member.id = uuid.uuid4()
        self._members[(member.team_id, member.user_id)] = member
        self._attach_user(member)
        return member

    async def save_member(self, member: TeamMember) -> TeamMember:
        self._members[(member.team_id, member.user_id)] = member
        self._attach_user(member)
        return member

    async def get_member(self, team_id, user_id):
        member = self._members.get((team_id, user_id))
        if member is not None:
            self._attach_user(member)
        return member

    async def list_members(self, team_id):
        members = [m for (tid, _), m in self._members.items() if tid == team_id]
        for member in members:
            self._attach_user(member)
        return members

    async def delete_member(self, member: TeamMember) -> None:
        self._members.pop((member.team_id, member.user_id), None)

    def _attach_user(self, member: TeamMember) -> None:
        user = self.users.get(member.user_id)
        if user is not None:
            member.user = user


class FakeUserRepository:
    """Stub mínimo del repositorio de usuarios (otro bounded context)."""

    def __init__(self) -> None:
        self._users: dict[uuid.UUID, SimpleNamespace] = {}

    def register(
        self, name="Ana", last_name="Gomez", position=UserPosition.DESARROLLADOR
    ):
        user_id = uuid.uuid4()
        user = SimpleNamespace(
            id=user_id,
            name=name,
            last_name=last_name,
            position=position,
            is_deleted=False,
        )
        self._users[user_id] = user
        return user

    async def get_by_id(self, user_id):
        return self._users.get(user_id)


@pytest.fixture
def team_repo() -> FakeTeamRepository:
    return FakeTeamRepository()


@pytest.fixture
def user_repo() -> FakeUserRepository:
    return FakeUserRepository()


def _register(team_repo, user_repo, **kwargs):
    """Crea un usuario y lo hace visible tanto al stub de usuarios como al
    directorio interno del fake de equipos (para reconstruir respuestas)."""
    user = user_repo.register(**kwargs)
    team_repo.users[user.id] = user
    return user


class TestTeamUseCases:
    async def test_create_team(self, team_repo):
        response = await CreateTeamUseCase(team_repo).execute(
            CreateTeamRequest(name="Equipo de Desarrollo", description="Backend")
        )

        assert response.name == "Equipo de Desarrollo"
        assert response.member_count == 0

    async def test_create_team_rejects_duplicate_name(self, team_repo):
        await CreateTeamUseCase(team_repo).execute(CreateTeamRequest(name="Diseño"))

        with pytest.raises(ConflictError):
            await CreateTeamUseCase(team_repo).execute(CreateTeamRequest(name="Diseño"))

    async def test_update_team(self, team_repo):
        created = await CreateTeamUseCase(team_repo).execute(
            CreateTeamRequest(name="Equipo A")
        )

        updated = await UpdateTeamUseCase(team_repo).execute(
            created.id, UpdateTeamRequest(name="Equipo B")
        )

        assert updated.name == "Equipo B"

    async def test_get_team_not_found(self, team_repo):
        with pytest.raises(NotFoundError):
            await GetTeamUseCase(team_repo).execute(uuid.uuid4())

    async def test_delete_team_is_soft(self, team_repo):
        created = await CreateTeamUseCase(team_repo).execute(
            CreateTeamRequest(name="Equipo A")
        )

        await DeleteTeamUseCase(team_repo).execute(created.id)

        with pytest.raises(NotFoundError):
            await GetTeamUseCase(team_repo).execute(created.id)

    async def test_list_teams_paginated(self, team_repo):
        for name in ("Equipo A", "Equipo B", "Equipo C"):
            await CreateTeamUseCase(team_repo).execute(CreateTeamRequest(name=name))

        result = await ListTeamsUseCase(team_repo).execute(
            None, Pagination.of(page=1, page_size=2)
        )

        assert result.total == 3
        assert len(result.items) == 2
        assert result.page == 1


class TestTeamMemberUseCases:
    async def test_add_member_defaults_to_integrante(self, team_repo, user_repo):
        team = await CreateTeamUseCase(team_repo).execute(
            CreateTeamRequest(name="Equipo A")
        )
        user = _register(team_repo, user_repo)

        member = await AddTeamMemberUseCase(team_repo, user_repo).execute(
            team.id, user.id, TeamRole.INTEGRANTE
        )

        assert member.user_id == user.id
        assert member.team_role == TeamRole.INTEGRANTE
        assert member.name == "Ana"

    async def test_add_member_unknown_user(self, team_repo, user_repo):
        team = await CreateTeamUseCase(team_repo).execute(
            CreateTeamRequest(name="Equipo A")
        )

        with pytest.raises(NotFoundError):
            await AddTeamMemberUseCase(team_repo, user_repo).execute(
                team.id, uuid.uuid4(), TeamRole.INTEGRANTE
            )

    async def test_add_member_rejects_duplicate(self, team_repo, user_repo):
        team = await CreateTeamUseCase(team_repo).execute(
            CreateTeamRequest(name="Equipo A")
        )
        user = _register(team_repo, user_repo)
        add = AddTeamMemberUseCase(team_repo, user_repo)

        await add.execute(team.id, user.id, TeamRole.INTEGRANTE)

        with pytest.raises(ConflictError):
            await add.execute(team.id, user.id, TeamRole.INTEGRANTE)

    async def test_change_member_role(self, team_repo, user_repo):
        team = await CreateTeamUseCase(team_repo).execute(
            CreateTeamRequest(name="Equipo A")
        )
        user = _register(team_repo, user_repo)
        await AddTeamMemberUseCase(team_repo, user_repo).execute(
            team.id, user.id, TeamRole.INTEGRANTE
        )

        member = await ChangeTeamMemberRoleUseCase(team_repo).execute(
            team.id, user.id, TeamRole.LIDER
        )

        assert member.team_role == TeamRole.LIDER

    async def test_change_role_of_unknown_member(self, team_repo):
        team = await CreateTeamUseCase(team_repo).execute(
            CreateTeamRequest(name="Equipo A")
        )

        with pytest.raises(NotFoundError):
            await ChangeTeamMemberRoleUseCase(team_repo).execute(
                team.id, uuid.uuid4(), TeamRole.LIDER
            )

    async def test_remove_member(self, team_repo, user_repo):
        team = await CreateTeamUseCase(team_repo).execute(
            CreateTeamRequest(name="Equipo A")
        )
        user = _register(team_repo, user_repo)
        await AddTeamMemberUseCase(team_repo, user_repo).execute(
            team.id, user.id, TeamRole.INTEGRANTE
        )

        await RemoveTeamMemberUseCase(team_repo).execute(team.id, user.id)

        members = await ListTeamMembersUseCase(team_repo).execute(team.id)
        assert members == []

    async def test_list_members(self, team_repo, user_repo):
        team = await CreateTeamUseCase(team_repo).execute(
            CreateTeamRequest(name="Equipo A")
        )
        ana = _register(team_repo, user_repo, name="Ana")
        luis = _register(team_repo, user_repo, name="Luis")
        add = AddTeamMemberUseCase(team_repo, user_repo)
        await add.execute(team.id, ana.id, TeamRole.INTEGRANTE)
        await add.execute(team.id, luis.id, TeamRole.LIDER)

        members = await ListTeamMembersUseCase(team_repo).execute(team.id)

        assert {m.name for m in members} == {"Ana", "Luis"}
