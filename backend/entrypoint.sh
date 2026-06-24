#!/bin/sh
set -e

echo "Corriendo migraciones..."
alembic upgrade head

echo "Iniciando servidor..."
exec uvicorn main:app --host 0.0.0.0 --port 8000 --workers "${WEB_CONCURRENCY:-1}"
