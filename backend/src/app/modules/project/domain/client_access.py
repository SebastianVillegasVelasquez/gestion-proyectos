import secrets

# Longitud en bytes del token; token_urlsafe produce ~1.33 caracteres por byte,
# así que 24 bytes → ~32 caracteres URL-safe. Suficiente entropía (>190 bits)
# para que el enlace del cliente sea impredecible.
_TOKEN_BYTES = 24


def generate_client_token() -> str:
    """Genera un token secreto e impredecible para el portal del cliente.

    Aislado en el dominio (no en el servicio) para poder testear su forma sin
    tocar la base de datos y para tener una sola fuente de verdad del formato.
    """
    return secrets.token_urlsafe(_TOKEN_BYTES)
