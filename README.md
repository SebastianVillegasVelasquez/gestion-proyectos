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

## Correo transaccional (Resend)

Los correos (bienvenida, avisos de tarea, entregas…) se envían con **Resend**.
El dominio `bitacora.objdigital.com.co` está verificado en Resend; **no se toca**
la configuración del dominio raíz `objdigital.com.co` (Hostinger).

Variables (en `backend/.env`; ver `backend/.env-example`):

| Variable | Descripción |
|---|---|
| `EMAIL_PROVIDER` | `resend` (producción) · `smtp` (legado) · `log` (no envía, solo registra). Si al proveedor le faltan credenciales, se degrada a `log` solo. |
| `RESEND_API_KEY` | API key de Resend. **Nunca se commitea**: va en el `.env` de producción y como *secret* en GitHub Actions (`RESEND_API_KEY`). |
| `EMAIL_FROM` | Remitente. Debe pertenecer a un dominio verificado en Resend. Prod: `Bitácora OBJ <no-reply@bitacora.objdigital.com.co>`. |

El resto de código nunca depende del SDK de Resend: todo pasa por la interfaz
`EmailSender` (`app/shared/email/sender.py`, patrón Adapter). Cambiar de
proveedor = añadir un adaptador y ajustar `build_email_sender`.

### Probar el envío en local

1. Deja `EMAIL_PROVIDER=log` (por defecto sin `RESEND_API_KEY`): los correos no
   salen, solo se registran en el log — útil para desarrollo sin claves.
2. Para probar un envío real: pon `RESEND_API_KEY` en `backend/.env` y usa un
   destinatario de una cuenta tuya.
   - **Panel del developer** (recomendado): inicia sesión con un usuario de rol
     `developer`, entra a **«Prueba de correo»** en el menú lateral, escribe el
     destinatario y pulsa enviar. Límite: 5 envíos por usuario por minuto.
   - **cURL**:
     ```bash
     curl -X POST http://localhost:8000/api/v1/dev/email-test \
       -H "Authorization: Bearer <token-developer>" \
       -H "Content-Type: application/json" \
       -d '{"to":"tu-correo@ejemplo.com"}'
     ```

> Con Resend, en modo de pruebas los destinatarios `@example.com` se rechazan;
> usa una dirección real.

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