# OBJ Digital Project Management System

Sistema privado de gestión de proyectos desarrollado para OBJ Digital S.A.S con el objetivo de optimizar la trazabilidad, seguimiento, automatización y supervisión de proyectos de virtualización de cursos y contratos empresariales.

---

# Descripción

La plataforma permitirá gestionar proyectos, equipos, tareas, cronogramas, métricas y reportes de manera centralizada, reemplazando procesos manuales actualmente realizados mediante hojas de cálculo.

El sistema incluye:

- Gestión de proyectos
- Gestión de tareas y subtareas
- Seguimiento de cronogramas
- Visualización de métricas
- Diagramas de Gantt
- Gestión de roles y permisos
- Alertas y notificaciones
- Reportes automáticos con IA
- Portal de visualización para clientes

---

# Arquitectura General

```text
Frontend React + TypeScript
            |
            v
Backend FastAPI
            |
            +--> PostgreSQL
            |
            +--> Redis
            |
            +--> Servicio IA
            |
            +--> Servicio de correos
```

---

# Stack Tecnológico

## Backend

- Python
- FastAPI
- SQLAlchemy 2
- Alembic
- PostgreSQL
- asyncpg
- Pydantic
- Pytest
- Ruff
- MyPy

## Frontend

- React
- TypeScript
- Vite
- TailwindCSS
- shadcn/ui
- TanStack Query
- Zustand
- React Hook Form
- Zod

## Infraestructura

- Docker
- Docker Compose
- Nginx
- GitHub Actions

---

# Estructura del Proyecto

```text
project-root/
│
├── backend/
│
├── frontend/
│
├── docker-compose.yml
├── .env
├── README.md
├── Makefile
└── .github/
```

---

# Requisitos Previos

- Docker
- Docker Compose
- Python 3.12+
- Poetry
- Node.js 20+
- pnpm

---

# Variables de Entorno

Crear archivo `.env` en la raíz del proyecto.

Ejemplo:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=objdigital
POSTGRES_PORT=5432

DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/objdigital

SECRET_KEY=your_secret_key

OPENAI_API_KEY=your_openai_api_key
```

---

# Instalación del Proyecto

## Clonar repositorio

```bash
git clone <repository-url>
```

---

# Backend

## Instalar dependencias

```bash
cd backend
poetry install
```

## Ejecutar migraciones

```bash
poetry run alembic upgrade head
```

## Ejecutar servidor

```bash
poetry run uvicorn app.main:app --reload
```

---

# Frontend

## Instalar dependencias

```bash
cd frontend
pnpm install
```

## Ejecutar aplicación

```bash
pnpm dev
```

---

# Docker

## Levantar proyecto completo

```bash
docker compose up --build
```

---

# Makefile

## Levantar proyecto

```bash
make up
```

## Detener proyecto

```bash
make down
```

## Ejecutar tests backend

```bash
make backend-test
```

## Ejecutar lint backend

```bash
make backend-lint
```

## Ejecutar frontend

```bash
make frontend-dev
```

---

# Testing

## Backend

```bash
cd backend
poetry run pytest
```

## Frontend

```bash
cd frontend
pnpm test
```

---

# Linting

## Backend

```bash
poetry run ruff check .
poetry run mypy .
```

## Frontend

```bash
pnpm lint
```

---

# Objetivos del Sistema

- Centralizar gestión de proyectos
- Mejorar trazabilidad
- Automatizar seguimiento
- Reducir errores manuales
- Mejorar visualización de métricas
- Facilitar supervisión de equipos
- Generar reportes automáticos
- Permitir visualización para clientes

---

# Características Principales

## Gestión de Proyectos

- Creación de proyectos
- Estados
- Equipos
- Cronogramas
- Componentes

## Gestión de Tareas

- Tareas
- Subtareas
- Dependencias
- Prioridades
- Retrasos

## Roles

- Super administrador
- Coordinadores
- Integrantes
- Clientes

## Notificaciones

- Alertas
- Correos automáticos
- Recordatorios

## IA

- Resúmenes automáticos
- Reportes ejecutivos
- Estados del proyecto

---

# Buenas Prácticas del Proyecto

- Arquitectura modular
- Tipado estricto
- Testing automatizado
- Docker desde desarrollo
- Monorepo
- Linting y formateo automático
- Separación por dominios
- Variables de entorno seguras

---

# Estado del Proyecto

En desarrollo.

---

# Licencia

Proyecto privado desarrollado para OBJ Digital S.A.S.