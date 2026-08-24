# Builder image as the base image for the backend
FROM python:3.13-slim AS builder

# Creates a working directory for the backend application
WORKDIR /app

# Configures the environment variable to create a virtual environment in the project directory
ENV POETRY_VIRTUALENVS_IN_PROJECT=true \
    POETRY_VIRTUALENVS_CREATE=true \
    POETRY_NO_INTERACTION=1

# Installs Poetry for dependency management
RUN pip install --no-cache-dir "poetry==2.4.0"

# Copies the dependency files from the host to the working directory in the container
COPY pyproject.toml poetry.lock ./

# Installs the dependencies defined in the pyproject.toml file using Poetry, excluding the root package and without ANSI output
RUN poetry install --only main --no-root --no-ansi

# Copies the source code of the backend application from the host to the working directory in the container
COPY src/ ./src/
COPY main.py ./

# Installs the app as a package in the container, excluding the root package and without ANSI output
RUN poetry install --only main --no-ansi

# Base image for the backend application, used for both development and production stages
FROM python:3.13-slim AS base

# Sets the working directory for the backend application in the production image
WORKDIR /app

# Update, upgrade, and install necessary packages for the production environment
# Then remove the package lists to reduce the image size
RUN apt-get update \
    && apt install -y --no-install-recommends \
        postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Creates a non-root user for running the backend application in the production image
RUN useradd --no-create-home --shell /bin/false --uid 1001 appuser

# Copies the virtual environment from the builder image to the production image
COPY --from=builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"

# Copies the source code from the host to the working directory in the production image
COPY src/ ./src/
COPY main.py ./
COPY ./alembic ./alembic/
COPY ./alembic.ini ./
COPY ./entrypoint.sh ./

# Changes the ownership of the application files to the non-root user
RUN chmod +x entrypoint.sh \
    && chown -R appuser:appuser /app

# Documents the port on which the backend application will listen for incoming requests
EXPOSE 8000

# Production image for the backend
FROM base AS prod

USER appuser
EXPOSE 8000

# Runs the backend application as the non-root user
CMD ["./entrypoint.sh"]

# Development image for the backend
FROM base AS dev

# Enables Uvicorn auto-reload for development
ENV UVICORN_RELOAD=true

USER appuser
EXPOSE 8000

# Runs the backend application as the non-root user in the development image
CMD ["./entrypoint.sh"]
