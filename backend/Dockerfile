# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM python:3.13-slim AS builder

WORKDIR /app

# Pin poetry to avoid supply-chain drift; update this when upgrading intentionally
RUN pip install --no-cache-dir "poetry==2.1.3"

# Keep the venv inside the project so the runtime stage can copy it cleanly
ENV POETRY_VIRTUALENVS_IN_PROJECT=true \
    POETRY_VIRTUALENVS_CREATE=true \
    POETRY_NO_INTERACTION=1

# Install deps first (cached layer) before copying source code
COPY pyproject.toml poetry.lock ./
RUN poetry install --only main --no-root --no-ansi

# Install the local "app" package
COPY src/ ./src/
COPY main.py ./
RUN poetry install --only main --no-ansi

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM python:3.13-slim

WORKDIR /app

# pg_isready is used in entrypoint.sh to wait for the database
RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Non-root user: reduces blast radius if the process is compromised
RUN useradd --no-create-home --shell /bin/false --uid 1001 appuser

# Bring in the virtualenv (poetry + pip are NOT copied)
COPY --from=builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"

# Copy only the files needed at runtime
COPY src/ ./src/
COPY main.py ./
COPY alembic/ ./alembic/
COPY alembic.ini ./
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000
CMD ["./entrypoint.sh"]
