class TestFakeRepositoryInterface:
    async def test_should_add_user_to_repository(
        self,
        fake_user_repo,
        fake_user,
    ):
        result = await fake_user_repo.add(fake_user)

        users = await fake_user_repo.get_all()

        assert result == fake_user
        assert fake_user in users
        assert len(users) == 1

    async def test_add_method(self, fake_user_repo, fake_user):
        amount_user_before = len(fake_user_repo.items)
        result = await fake_user_repo.add(fake_user)
        assert result == fake_user
        assert len(fake_user_repo.items) == amount_user_before + 1

    async def test_should_get_user_by_id(
        self,
        fake_user_repo,
        fake_user,
    ):
        await fake_user_repo.add(fake_user)

        result = await fake_user_repo.get_by_id(fake_user.id)

        assert result == fake_user

    async def test_should_return_all_users(
        self,
        fake_user_repo,
        fake_users,
    ):
        for user in fake_users:
            await fake_user_repo.add(user)

        result = await fake_user_repo.get_all()

        assert len(result) == 10

        for user in fake_users:
            assert user in result

    async def test_should_get_user_by_email(
        self,
        fake_user_repo,
        fake_user,
    ):
        await fake_user_repo.add(fake_user)

        result = await fake_user_repo.get_by_email(fake_user.email)

        assert result == fake_user
