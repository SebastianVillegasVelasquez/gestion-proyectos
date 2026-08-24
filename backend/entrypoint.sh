#!/bin/sh
set -e

echo "Esperando a Postgres..."

until pg_isready \
    -h "$DATABASE_HOST" \
    -p "$DATABASE_PORT" \
    -U "$DATABASE_USER"; do
    sleep 1
done

echo "Postgres disponible."

echo "Corriendo migraciones..."
alembic upgrade head

echo "Migraciones completadas."

if [ "${UVICORN_RELOAD:-false}" = "true" ]; then
    echo "Iniciando Uvicorn en modo desarrollo con reload..."

    exec uvicorn main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --workers 1 \
        --reload
else
    echo "Iniciando Uvicorn en modo producción..."

    exec uvicorn main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --workers "${WEB_CONCURRENCY:-1}"
fi
