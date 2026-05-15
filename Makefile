# =========================
# Docker
# =========================

up:
	docker compose up --build

down:
	docker compose down

restart:
	docker compose down && docker compose up --build

logs:
	docker compose logs -f

# =========================
# Backend
# =========================

backend-dev:
	cd backend && poetry run uvicorn app.main:app --reload

backend-test:
	cd backend && poetry run pytest

backend-lint:
	cd backend && poetry run ruff check .

backend-format:
	cd backend && poetry run ruff format .

backend-mypy:
	cd backend && poetry run mypy .

backend-migrate:
	cd backend && poetry run alembic upgrade head

backend-makemigrations:
	cd backend && poetry run alembic revision --autogenerate -m "migration"

# =========================
# Frontend
# =========================

frontend-dev:
	cd frontend && pnpm dev

frontend-test:
	cd frontend && pnpm test

frontend-lint:
	cd frontend && pnpm lint

frontend-build:
	cd frontend && pnpm build

# =========================
# Full checks
# =========================

check:
	make backend-lint
	make backend-mypy
	make backend-test
	make frontend-lint
	make frontend-test