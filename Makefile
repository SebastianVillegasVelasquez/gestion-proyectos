# =========================
# Docker
# =========================

up:
	docker compose up --build -d

down:
	docker compose down

restart:
	docker compose down && docker compose up --build

logs:
	docker compose logs -f

build-back:
	cd backend && docker build -t backend-image .

run-back:
	make build-back
	docker run -p8000:80 -d --name backend-container backend-image

remove-back:
	docker stop backend-container
	docker rm backend-container
	docker image rm backend-image

build-front:
	cd frontend && docker build --progress=plain --no-cache -t frontend-image .

run-front: build-front
	docker system prune -af
	docker rm -f frontend-container || true
	docker run -p 3000:3000 -d --name frontend-container frontend-image

stop-front:
	docker stop frontend-container

logs-front:
	docker logs -f frontend-container

shell-front:
	docker exec -it frontend-container sh

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
