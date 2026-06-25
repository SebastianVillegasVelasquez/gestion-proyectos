#!/bin/sh
set -e
echo "Esperando a Postgres..."
until pg_isready -h "$DATABASE_HOST" -p "$DATABASE_PORT" -U "$DATABASE_USER"; do
  sleep 1
done
echo "Corriendo migraciones..."
alembic upgrade head
exec uvicorn main:app --host 0.0.0.0 --port 8000 --workers "${WEB_CONCURRENCY:-1}"
