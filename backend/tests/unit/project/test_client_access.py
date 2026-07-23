from app.modules.project.domain.client_access import generate_client_token


class TestGenerateClientToken:
    def test_produces_a_nonempty_urlsafe_token(self):
        token = generate_client_token()
        assert token
        # token_urlsafe usa solo el alfabeto URL-safe: [A-Za-z0-9_-].
        assert all(c.isalnum() or c in "-_" for c in token)

    def test_tokens_are_unique(self):
        tokens = {generate_client_token() for _ in range(100)}
        assert len(tokens) == 100

    def test_has_enough_entropy(self):
        # 24 bytes -> ~32 caracteres; margen amplio contra fuerza bruta.
        assert len(generate_client_token()) >= 32
