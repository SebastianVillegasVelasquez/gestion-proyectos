"""E2E del healthcheck usado por orquestadores/balanceadores."""


class TestHealthcheck:
    async def test_health_responds_with_status_shape(self, client):
        resp = await client.get("/health")
        # 200 si la BD responde, 503 si está degradada; nunca debe 500.
        assert resp.status_code in (200, 503)
        body = resp.json()
        assert "status" in body
        assert "database" in body
