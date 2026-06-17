from app.shared.pagination import MAX_PAGE_SIZE, Pagination, pagination_params


class TestPagination:
    def test_offset_is_zero_on_first_page(self):
        p = Pagination.of(page=1, page_size=10)
        assert p.offset == 0
        assert p.limit == 10

    def test_offset_scales_with_page(self):
        assert Pagination.of(page=3, page_size=20).offset == 40

    def test_clamps_page_to_minimum_one(self):
        assert Pagination.of(page=0).page == 1
        assert Pagination.of(page=-5).page == 1

    def test_clamps_page_size_between_one_and_max(self):
        assert Pagination.of(page_size=0).page_size == 1
        assert Pagination.of(page_size=9999).page_size == MAX_PAGE_SIZE

    def test_dependency_builds_clamped_pagination(self):
        p = pagination_params(page=2, page_size=5)
        assert p.page == 2 and p.page_size == 5 and p.offset == 5
