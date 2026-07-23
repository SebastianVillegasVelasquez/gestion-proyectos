# Conceptos profesionales — guía de estudio

Objetivo: entender **cómo funcionan los sistemas** para poder dirigir a la IA
con criterio (automatizar conocimiento, no "vibe coding"). Cada concepto trae:
**Qué es · Por qué importa · Cómo lo usamos · Para profundizar.**

Basado en lo construido en este proyecto (FastAPI + React + Postgres).

---

## A. ARQUITECTURA Y ORGANIZACIÓN

### A1. Arquitectura por capas (DDD)
- **Qué es:** separar el código en capas: `presentation` (rutas HTTP) →
  `application` (use cases) → `domain` (servicios + reglas de negocio) →
  `infrastructure` (modelos ORM, repositorios).
- **Por qué importa:** la regla de negocio no debe depender de HTTP ni de la base
  de datos. Si mañana cambias FastAPI por otra cosa, el dominio no se entera.
- **Cómo lo usamos:** cada módulo backend (identity, project, tasks, dashboard)
  tiene esas 4 carpetas. Las rutas solo traducen HTTP ↔ caso de uso.
- **Para profundizar:** Domain-Driven Design (Eric Evans / "DDD Distilled"),
  Clean Architecture (Robert C. Martin).

### A2. Módulos por feature (alta cohesión, bajo acoplamiento)
- **Qué es:** organizar por *qué hace* (project, tasks) y no por *tipo técnico*
  (todos los modelos juntos, todas las rutas juntas).
- **Por qué importa:** al crecer, encuentras todo lo de una feature en un lugar;
  los cambios quedan contenidos.
- **Cómo lo usamos:** backend en `modules/<feature>`; frontend en
  `features/<feature>/{api,hooks,types,utils,components}`.
- **Para profundizar:** "Screaming Architecture", modular monolith.

### A3. Patrón Repository
- **Qué es:** una clase que encapsula el acceso a datos detrás de métodos
  (`get_by_id`, `get_all_by_project`...).
- **Por qué importa:** el servicio no sabe SQL; puedes inyectar un "fake" en
  tests sin tocar la DB.
- **Cómo lo usamos:** `TaskRepository`, `ProjectRepository`, etc. Bug real que
  encontramos: un repo apuntaba a la tabla equivocada → lo cazamos porque
  entendíamos el patrón.
- **Para profundizar:** Repository & Unit of Work (Martin Fowler, PoEAA).

### A4. Use Case / Service
- **Qué es:** una clase que orquesta UNA operación de negocio
  (`CreateTaskUseCase`).
- **Por qué importa:** la ruta queda mínima; la lógica es testeable y reutilizable.
- **Para profundizar:** "Application Services" en DDD.

### A5. Inyección de dependencias (DI)
- **Qué es:** las dependencias (repos, sesión de DB) se reciben desde afuera, no
  se crean adentro.
- **Por qué importa:** desacopla y facilita testear (inyectas un mock).
- **Cómo lo usamos:** `Depends(...)` de FastAPI inyecta repos y sesión.
- **Para profundizar:** Dependency Inversion Principle (la "D" de SOLID).

### A6. Funciones puras + separación de lógica (frontend)
- **Qué es:** sacar la lógica (cálculos, transformaciones) a funciones sin React
  ni efectos secundarios.
- **Por qué importa:** se testean en milisegundos y sin montar componentes.
- **Cómo lo usamos:** `build-task-payload`, `timeline`, `group-members`,
  `tree-ops`, `persist-draft`. Todas con tests unitarios.
- **Para profundizar:** programación funcional básica, "pure functions".

---

## B. DATOS, ESTADO Y CONSISTENCIA

### B1. ORM + Migraciones (SQLAlchemy + Alembic)
- **Qué es:** el ORM mapea clases ↔ tablas; las migraciones versionan los
  cambios de esquema.
- **Por qué importa:** la base de datos evoluciona de forma controlada y repetible.
- **PELIGRO real (lo vivimos):** *drift* — el modelo y la migración se
  desincronizan (la tabla `tasks` no tenía columnas que el modelo sí). Siempre
  verifica que la migración refleje el modelo.
- **Para profundizar:** migraciones, "schema as code", `alembic autogenerate` y
  sus límites.

### B2. Transacciones
- **Qué es:** un conjunto de operaciones que se confirman (`commit`) o se
  revierten (`rollback`) como una sola unidad.
- **Por qué importa:** consistencia — o pasa todo, o no pasa nada.
- **Para profundizar:** ACID, niveles de aislamiento.

### B3. Soft delete
- **Qué es:** borrar marcando una fecha (`deleted_at`) en lugar de eliminar la fila.
- **Por qué importa:** preservas historia y permites auditoría/recuperación.
- **Para profundizar:** patrones de borrado lógico y sus costos (filtrar siempre).

### B4. Idempotencia
- **Qué es:** una operación que puedes repetir sin duplicar efectos.
- **Por qué importa:** seeds, reintentos, webhooks: deben poder correr varias veces.
- **Cómo lo usamos:** el seed de super admin y de datos demo: "si ya existe, no recrear".
- **Para profundizar:** idempotencia en APIs (claves de idempotencia).

### B5. Estado de servidor vs estado de UI (frontend)
- **Qué es:** datos que viven en el backend (proyectos, tareas) vs estado local
  de la interfaz (un modal abierto).
- **Por qué importa:** son distintos; el de servidor se gestiona con cache y
  revalidación, no con `useState`.
- **Cómo lo usamos:** TanStack Query para datos de servidor; `useState` solo para UI.
- **Para profundizar:** "server state" (TanStack Query docs), SWR.

### B6. Query keys + cache compartido + invalidación
- **Qué es:** una clave estable identifica cada dato cacheado; varios componentes
  la reusan; tras una mutación se "invalida" para refrescar.
- **Por qué importa:** evitas peticiones duplicadas y mantienes la UI consistente.
- **Cómo lo usamos:** `query-keys.ts` central; al crear/editar invalidamos la clave.
- **Para profundizar:** cache invalidation, stale-while-revalidate.

---

## C. SEGURIDAD

### C1. Autenticación vs Autorización
- **Qué es:** AuthN = ¿quién eres? · AuthZ = ¿qué puedes hacer?
- **Por qué importa:** son problemas distintos; confundirlos abre huecos.
- **Cómo lo usamos:** `ProtectedRoute` (autenticación) + `RoleGuard` /
  `require_role` (autorización).

### C2. JWT: access + refresh + flujo de refresco
- **Qué es:** token de acceso corto (minutos) + token de refresco largo (días).
  Al expirar el de acceso, se renueva en silencio con el de refresco y se
  reintenta la petición.
- **Por qué importa:** seguridad (tokens cortos) sin molestar al usuario.
- **Cómo lo usamos:** interceptor de Axios que ante un 401 refresca y reintenta,
  con *single-flight* (varios 401 comparten un solo refresh).
- **Para profundizar:** OAuth2, rotación de refresh tokens, dónde guardarlos
  (cookie httpOnly vs localStorage y sus tradeoffs).

### C3. La seguridad real vive en el backend
- **Qué es:** los guards del frontend son UX (qué muestro); la verdadera barrera
  es el backend (qué permito ejecutar).
- **Por qué importa:** cualquiera abre DevTools y se salta el frontend.
- **Para profundizar:** "defense in depth", validación server-side.

### C4. Autorización por roles (RBAC) y por contexto
- **Qué es:** roles globales (admin/super_admin/user) + roles por proyecto
  (coordinador/supervisor/integrante...).
- **Por qué importa:** distintos permisos según el contexto.
- **Cómo lo usamos:** `require_role` y `require_project_permission`.
- **Para profundizar:** RBAC vs ABAC.

### C5. Hashing de contraseñas y secretos
- **Qué es:** nunca guardar contraseñas en texto plano (usar argon2/bcrypt);
  los secretos van en variables de entorno.
- **Para profundizar:** salting, funciones de hashing lentas, gestión de secretos.

---

## D. RENDIMIENTO

### D1. Problema N+1
- **Qué es:** hacer 1 query para la lista y N queries extra (una por elemento).
- **Por qué importa:** es la causa #1 de lentitud silenciosa.
- **Cómo lo usamos:** el dashboard calcula 4 KPIs en **2 queries** con `CASE WHEN`
  en lugar de recorrer tarea por tarea.
- **Para profundizar:** `selectinload`/`joinedload`, EXPLAIN/query plan.

### D2. Paralelo vs cascada (waterfall)
- **Qué es:** pedir datos en paralelo en vez de uno tras otro.
- **Por qué importa:** el tiempo total es el del más lento, no la suma.
- **Cómo lo usamos:** `useQueries` para traer tareas de varios nodos a la vez.
- **Para profundizar:** `Promise.all`, request waterfalls.

### D3. Índices y caching
- **Qué es:** índices en columnas de filtro/FK; cache con TTL para no repedir.
- **Cómo lo usamos:** índices en FKs; `staleTime` en TanStack Query.
- **Para profundizar:** B-tree indexes, cuándo un índice ayuda y cuándo estorba;
  Redis (cuándo SÍ hace falta: medido, no por defecto).

### D4. Rendimiento en frontend
- **Qué es:** memoización (`useMemo`), inicialización perezosa de estado, evitar
  renders en cascada, *code-splitting* cuando el bundle crece.
- **Cómo lo usamos:** lazy init en Login, `useMemo` para datos derivados; vimos el
  warning de bundle >500 kB.
- **Para profundizar:** React rendering model, memo/useCallback, lazy/Suspense.

---

## E. CALIDAD Y MANTENIBILIDAD

### E1. Pirámide de tests
- **Qué es:** muchos unitarios (rápidos, lógica pura) + algunos de integración
  (flujo real con DB) + pocos end-to-end.
- **Por qué importa:** confianza para cambiar sin romper, a bajo costo.
- **Cómo lo usamos:** reglas de negocio y utilidades testeadas en unitarios;
  endpoints en integración.
- **Para profundizar:** test pyramid, AAA (Arrange-Act-Assert).

### E2. Fakes, mocks y fixtures
- **Qué es:** dobles de prueba para aislar lo que pruebas (repos falsos en memoria).
- **Para profundizar:** test doubles (Fowler), pytest fixtures, vitest mocks.

### E3. Automatización de calidad
- **Qué es:** lint + formato + pre-commit + CI corriendo solos.
- **Por qué importa:** la calidad no se confía a la memoria humana.
- **Cómo lo usamos:** ESLint/Prettier, lint-staged, pre-commit, GitHub Actions.
- **Para profundizar:** CI/CD, "shift left".

### E4. Conventional commits
- **Qué es:** mensajes con prefijo semántico (`feat`, `fix`, `refactor`...).
- **Por qué importa:** historial legible y automatizable (changelogs, versiones).

---

## F. MODELADO DE DOMINIO / REGLAS DE NEGOCIO

### F1. Las reglas viven en el dominio
- **Qué es:** la lógica de negocio va en servicios/funciones de dominio, no en
  rutas ni en la UI.
- **Cómo lo usamos:** finish-to-start ("no inicies una tarea si su dependencia no
  terminó") y bloqueo por fase ("no empieces la fase 2 si la 1 sigue abierta"),
  en funciones puras (`rules.py`).
- **Para profundizar:** domain services, invariantes de dominio.

### F2. Validación en capas
- **Qué es:** el cliente valida para UX; el servidor revalida por seguridad.
- **Por qué importa:** nunca confíes solo en el frontend.

### F3. Modelado flexible
- **Qué es:** permitir que una entidad cuelgue de A o de B con una regla clara
  ("exactamente uno").
- **Cómo lo usamos:** una tarea pertenece a un nodo O a una fase.
- **Para profundizar:** nullable + constraint, polimorfismo de asociación.

---

## G. OPERACIÓN Y NUBE (lo que viene)

- **Migraciones como paso del deploy** (nunca editar la DB a mano).
- **Persistencia:** volúmenes nombrados (la data sobrevive reinicios) vs efímeros
  (tests con `tmpfs`).
- **Lifespan / startup hooks:** tareas al arrancar (seeds, checks de salud).
- **Variables de entorno y secretos por ambiente** (dev/prod separados).
- **Observabilidad:** logs estructurados, métricas, trazas.
- **Contenedores y CI/CD:** build reproducible, pruebas antes de desplegar.
- **Para profundizar:** Docker, 12-Factor App, infra as code, monitoreo (Prometheus/Grafana).

---

## Cómo usar esta guía

1. Lee un bloque, cierra el archivo y **explícalo en voz alta** (técnica Feynman).
   Donde te trabes, ahí está tu hueco.
2. Elige UN concepto por semana y haz un **clavado de profundidad** (lee docs
   oficiales + reconstruye un ejemplo desde cero, sin IA).
3. Antes de aceptar código de la IA, pregúntate: **"¿podría defender esta
   decisión y detectar si está mal?"**. Si no, estudia ese concepto primero.

La meta no es teclear más rápido que la IA. Es entender el sistema lo suficiente
para **dirigirla y responder por el resultado**.
