# Mini-proyecto de práctica: "PingBoard" — chat/notificaciones en tiempo real

> Objetivo: **reforzar** lo aprendido (WebSockets, Redis pub/sub, asyncio,
> hexagonal, React hooks) construyendo algo nuevo desde cero, sin la red de
> seguridad del proyecto grande. El foco es la **lógica**, no el diseño visual.

---

## ¿Qué construyes?

**PingBoard**: una app mínima donde usuarios autenticados se unen a "salas" y se
envían mensajes en tiempo real. Además, un "system bot" emite notificaciones
(p. ej. "Fulano entró", "Fulano salió"). Es el mismo patrón que ya dominas
(pub/sub → WS → cliente), pero con un giro nuevo: **mensajes con contenido real**
y **salas** (canales por sala, no por usuario).

Lo eliges deliberadamente porque te obliga a:
- Manejar **canales dinámicos** (`room:{id}`) en lugar de uno fijo por usuario.
- Enviar **payloads con datos** (texto, autor, timestamp), no solo un "avísame".
- Decidir entre **opción A** (mandar el mensaje completo por WS) y **opción B**
  (avisar + re-fetch). Para chat, la opción A tiene sentido → aprenderás el otro
  lado del trade-off.

### ¿React sí o no?
**Sí, úsalo** — pero mínimo. Es la mejor forma de afianzar `useEffect`, `useRef`,
cleanup y estado. No hagas diseño: una lista de mensajes y un input basta. Si te
agobia, primero haz el cliente con HTML+JS plano (un `.html` con `<script>`) para
ver el WS funcionando, y **luego** migra ese cliente a un componente React. Esa
migración es, en sí misma, un ejercicio de aprendizaje excelente.

---

## Requisitos técnicos (obligatorios)

1. **Docker Compose** que levante: `api` (FastAPI), `redis`, y opcionalmente `web`
   (Vite dev server). Redis **sin volumen** (pub/sub efímero).
2. **Backend FastAPI + asyncio**:
   - Puerto `Broadcaster` (ABC) con `InMemoryBroadcaster` y `RedisBroadcaster`
     (¡reutiliza lo que ya escribiste, cópialo y adáptalo!).
   - `RoomManager` (tu `ConnectionManager` renombrado) con canales `room:{id}`.
   - Endpoint `WS /ws/rooms/{room_id}?token=...` con auth JWT.
   - Endpoint HTTP `GET /rooms/{id}/messages` (historial, paginado) y
     `POST /rooms/{id}/messages` (persistir + publicar).
   - Persistencia: puede ser Postgres **o** SQLite (para simplificar). La regla
     sigue: **la BD es la fuente de verdad**.
3. **Redis pub/sub** como bus entre workers. Arranca la `api` con
   `uvicorn --workers 2` y demuéstrate a ti mismo que un mensaje enviado a un
   worker llega a un cliente conectado en el otro.
4. **Frontend React/TS**: hook `useRoomSocket(roomId)` con reconexión (backoff),
   cleanup correcto y render de la lista de mensajes.
5. **Tests**: al menos los del `Broadcaster` (memoria), el `RoomManager` y un
   end-to-end en memoria; en el front, el test del hook con `WebSocket` mockeado.

---

## Hitos progresivos (haz uno, verifica, sigue)

### Hito 0 — Infra
`docker-compose.yml` con `api` + `redis`. Verifica `redis-cli ping → PONG` y que
la `api` responde `GET /health`.

### Hito 1 — Broadcaster (copia y entiende)
Trae tu `Broadcaster` + `InMemoryBroadcaster` + `RedisBroadcaster`. Escribe sus
tests primero. **Reto:** añade `maxsize` a las colas del InMemory y decide qué
hacer ante `QueueFull` (descartar vs desconectar al lento). Eso es *backpressure*.

### Hito 2 — RoomManager + WS
Endpoint WS por sala. Prueba con Postman/`wscat`: conéctate a `room:1`, publica a
mano por `redis-cli PUBLISH room:1 "hola"` y velo llegar.

### Hito 3 — Enviar mensajes de verdad
`POST /rooms/{id}/messages` persiste y publica el mensaje **completo**
(`{type:"message.new", id, author, text, at}`). Aquí eliges **opción A**: el
front pinta el mensaje directo desde el WS. **Reto de diseño:** ¿cómo evitas
duplicados si el autor también recibe su propio mensaje por el WS? (pista:
`optimistic update` + de-dupe por id).

### Hito 4 — Frontend React
`useRoomSocket(roomId)` + una vista con lista e input. Al montar, hace
`GET /messages` (historial) y abre el WS (nuevos). *Reconcile on connect*.

### Hito 5 — Escala real
`uvicorn --workers 2`. Abre dos navegadores, cada uno cae (con suerte) en un
worker distinto. Confirma que los mensajes cruzan gracias a Redis. Apaga Redis a
mitad y observa: los WS se caen, el front reconecta, el historial HTTP se
mantiene. **Escribe qué observaste** en un `NOTES.md`.

---

## Retos extra (si quieres estirarte)

| Reto | Concepto que entrena |
|---|---|
| Indicador "Fulano está escribiendo…" | Eventos efímeros (no se persisten) |
| Presencia: quién está online en la sala | Canal `presence:room:{id}` + set en Redis |
| Límite de reconexiones + estado "desconectado" en UI | Manejo de fallos en el cliente |
| Rate limit de mensajes por usuario | Redis como contador con TTL |
| Multiplexar varios tipos en un WS (`message.new`, `typing`, `presence`) | Discriminated unions en TS (`switch payload.type`) |
| Migrar `RedisBroadcaster` a un `NatsBroadcaster` | El valor real del puerto/adaptador |

---

## Criterios de "terminado" (autoevaluación)

- [ ] Puedo explicar **con mis palabras** por qué Redis es necesario con 2 workers.
- [ ] El `Broadcaster` no sabe nada de WebSockets ni de salas (puerto estrecho).
- [ ] El `subscribe` limpia sus recursos en `finally` y no deja canales huérfanos.
- [ ] El hook de React cierra la conexión al desmontar (verificado en un test).
- [ ] Si apago Redis, la app **no pierde datos** (siguen en la BD) y se recupera.
- [ ] Tengo tests verdes de broadcaster, manager, end-to-end y el hook.

---

## Pistas de arranque (estructura sugerida)

```
pingboard/
├── docker-compose.yml            # api + redis (+ web opcional)
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI + lifespan (composition root)
│   │   ├── broadcasting/         # broadcaster.py, memory.py, redis.py
│   │   ├── rooms/                # room_manager.py, ws.py, routes.py, models.py
│   │   └── core/                 # config.py, security.py (JWT)
│   └── tests/
│       ├── test_memory_broadcaster.py
│       ├── test_room_manager.py
│       └── test_end_to_end.py
└── web/                          # Vite + React
    └── src/features/rooms/hooks/use-room-socket.ts (+ .test.tsx)
```

> Consejo final: **no copies-pega a ciegas** del proyecto grande. Reescríbelo
> mirando lo tuyo como referencia. El objetivo es que la segunda vez te salga
> del 80% de memoria — ahí es donde el conocimiento se vuelve tuyo.
