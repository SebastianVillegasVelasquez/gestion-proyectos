FROM python:3.13-slim

# WORKDIR distinto de "src" para evitar la ruta /src/src/app
WORKDIR /app

# postgresql-client aporta `pg_isready`, que el entrypoint usa para esperar a que
# la base de datos acepte conexiones antes de migrar/arrancar.
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Gestor de dependencias
RUN pip install --no-cache-dir poetry

# 1) Instala SOLO dependencias (sin el paquete local) para aprovechar la cache
COPY pyproject.toml poetry.lock ./
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi --only main --no-root

# 2) Copia el código y registra el paquete local "app" (definido en pyproject como from=src)
COPY . .
RUN poetry install --no-interaction --no-ansi --only main

EXPOSE 8000

COPY entrypoint.sh .
RUN chmod +x entrypoint.sh
CMD ["./entrypoint.sh"]
