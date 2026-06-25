# Checklist de producción (runbook)

Estado de los puntos del MVP de endurecimiento. ✅ = hecho en código · ⚙️ = depende
de tu entorno/deploy (configúralo tú) · 🕒 = pendiente, no bloqueante.

## Seguridad (bloqueantes)
- ✅ **Registro público no escala privilegios**: `POST /identity/` fuerza `role=user`.
  La creación con rol vive en `POST /identity/users` (solo admin).
- ✅ **Rate limit en login**: 10 intentos/IP/min en `POST /auth/login`. En memoria
  (por worker). ⚙️ A escala (varias instancias), mover a Redis.
- ✅ **Contraseñas**: cambio propio (`PATCH /identity/me/password`) y reset por admin
  (`POST /identity/users/{id}/reset-password`, devuelve temporal). Sin correo aún.
- ⚙️ **`SECRET_KEY`**: define una clave fuerte (>=32 chars) y DISTINTA por entorno.
  El backend ya avisa por log si arranca en no-dev con una clave débil.
- ⚙️ **`DEBUG=false`, `APP_ENV=production`**: en prod desactiva docs (`/docs`,`/redoc`
  ya se ocultan si no es dev) y el echo de SQL (ya atado a `IS_DEV`).
- ⚙️ **`CORS_ORIGINS`**: apunta al dominio real del frontend (hoy `localhost`).
- ⚙️ **Contraseñas sembradas**: define en `.env.backend` las contraseñas de los
  usuarios que quieras crear. Sin contraseña, el usuario NO se crea:
  `DEVELOPER_PASSWORD`, `ANA_PASSWORD`, `JORGE_PASSWORD`, `JHON_PASSWORD`,
  `SEBASTIAN_PASSWORD` y, si lo usas, `SUPERADMIN_PASSWORD`.

## Siembra de usuarios (al arrancar, según entorno)
La siembra está desacoplada en `app/core/seeding.run_seed()`:
- **Desarrollo** (`APP_ENV=development`): carga datos de demostración.
- **Producción**: crea los usuarios reales de OBJ Digital (cada uno solo si tiene
  contraseña en el entorno):
  - `developer@objdigital.com` → rol **developer** (tope de jerarquía + feedback).
  - `ana@`, `jorge@`, `jhon@objdigital.com` → rol **super_admin**.
  - `sebastian@objdigital.com` → rol **usuario**.
- Es idempotente (por email): no recrea ni pisa usuarios existentes.

## Salud / operación
- ✅ **Healthcheck**: `GET /health` (verifica la BD → 200/503). Úsalo en el
  orquestador/balanceador.
- ⚙️ **Backups de BD** automáticos + prueba de restauración.
- 🕒 **Monitoreo de errores** (p. ej. Sentry) en backend y frontend.

## Exposición y reverse proxy (HTTPS)
El sitio se publica con DOS capas de nginx:

1. **nginx del SO (host)** — público, escucha el dominio y **termina TLS (HTTPS)**.
   Es el *reverse proxy*: reenvía al contenedor.
2. **nginx del contenedor frontend** — sirve el SPA y proxya `/api/` → `backend:8000`
   por la red interna de Docker (ver `frontend/nginx.conf`).

Flujo: `navegador →(HTTPS)→ nginx del host →(HTTP a 127.0.0.1)→ nginx del contenedor
→ SPA y /api → backend`.

⚙️ **Para que el nginx del host alcance el contenedor**, el servicio `frontend` debe
**publicar un puerto al localhost del servidor** (hoy usa `expose`, que solo es
visible dentro de Docker). En `compose-prod.yaml`:

```yaml
  frontend:
    image: ghcr.io/SebastianVillegasVelasquez/bitacora-frontend:latest
    ports:
      - "127.0.0.1:8080:80"   # SOLO accesible desde el propio servidor
    networks:
      - bitacora-network
```

> Átalo a `127.0.0.1`, no a `0.0.0.0` (que es lo que hace `"8080:80"` a secas): así
> el contenedor NO queda expuesto directo a internet y TODO el tráfico externo pasa
> obligatoriamente por el nginx del host con HTTPS. El `backend` se queda con
> `expose: 8000` (nunca se publica; solo lo consume el nginx del contenedor).

Bloque del **nginx del host** (certbot añade el `listen 443 ssl` automáticamente):
```nginx
server {
    server_name app.objdigital.com;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
- ⚙️ **TLS/HTTPS**: emítelo en el nginx del host (`certbot --nginx`).
- Recuerda que `CORS_ORIGINS` debe incluir el dominio público (`https://app.objdigital.com`).

## Roles
- ✅ `DEVELOPER` (tope de jerarquía + bandeja de feedback).
- ✅ `CLIENT` (acceso restringido al portal de solo lectura) — *fontanería lista*;
  falta el comando "Generar acceso de cliente" + el envío de credenciales (tuyo).

## Correo
- 🕒 **SMTP sin conectar** (a la espera del correo corporativo). Borradores de diseño
  en `docs/email-drafts/` (acceso de cliente, reset de contraseña, bienvenida).
  Cuando definas el remitente, conéctalos al envío.

## Rendimiento (no bloqueante)
- 🕒 **Paginar `GET /projects`**: hoy devuelve la lista completa. Cuando crezca el
  volumen, paginar (cambia el contrato → actualizar también el frontend).
- ✅ Índices de FKs/columnas filtradas y N+1 de equipos (sesiones previas).

## Notificaciones
- 🕒 Pendiente (lo implementa el equipo con el patrón Observer / event bus ya existente).
