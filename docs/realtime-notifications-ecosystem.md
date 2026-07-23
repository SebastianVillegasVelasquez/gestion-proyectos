# Ecosistema de Notificaciones en Tiempo Real

> Documento de referencia — no es un paso a paso, es el **mapa mental** de cómo
> encajan WebSockets, Redis, el backend (FastAPI/asyncio) y el frontend
> (React/TS). Léelo cuando necesites recordar *por qué* algo está diseñado así.

---

## 1. El problema y por qué WebSockets

HTTP es **request/response**: el cliente pregunta, el servidor responde, se cierra.
El servidor no puede hablar "porque sí". Antes teníamos **polling** (el frontend
preguntaba cada 60 s "¿algo nuevo?"), con 3 costes: latencia (hasta 60 s),
desperdicio (99% de respuestas vacías) y escala (N usuarios × 1 request/60s).

Un **WebSocket** arranca como un GET HTTP con `Upgrade: websocket`, hace un
*handshake* (`101 Switching Protocols`) y deja la conexión **abierta y
bidireccional**. El servidor empuja mensajes cuando quiere. Analogía: HTTP es
enviar cartas; WebSocket es una llamada telefónica abierta.

**Regla de oro del diseño elegido:** el WebSocket es un **acelerador**
best-effort; la **base de datos es la fuente de verdad**. Si el WS falla o el
usuario está desconectado, la notificación sigue en Postgres y se recupera por
HTTP al reconectar (*reconcile on reconnect*).

---

## 2. Decisiones de arquitectura (y su razón)

| Decisión | Elegido | Por qué |
|---|---|---|
| Contenido del mensaje WS | **Solo avisar** (`{"type":"notification.new"}`), el front invalida cache y re-pide por HTTP | Una sola fuente de verdad (el endpoint HTTP); evita que WS y HTTP diverjan |
| Auth del WS | **JWT por query param** (`?token=...`) | El navegador no permite headers custom en `new WebSocket()` |
| Transporte entre workers | **Redis pub/sub** | Con 2+ workers, el estado en memoria de un worker no lo ve otro |
| Abstracción del bus | **Puerto `Broadcaster`** + adaptadores memoria/Redis | Tests sin infra, dev local simple, migración futura barata |
| Convención de canal | `notifications:user:{id}` | Granular por usuario; extensible a `chat:room:{id}`, `presence:project:{id}` |
| Suscripción a Redis | **Una por usuario conectado** (no un canal global filtrado) | Cero desperdicio de red; escala lineal, no cuadrático |

**Por qué el mensaje mínimo (opción B):** si mandáramos la notificación completa
por WS, tendríamos dos caminos de datos (WS y GET) que pueden pisarse — un GET
en vuelo con datos viejos podría sobrescribir lo que llegó por WS. Con "solo
avisar", el WS **dispara** el fetch y el fetch **es** la verdad.

---

## 3. El flujo completo (una notificación de punta a punta)

```
Bob crea una tarea para Ana
        │
        ▼
POST /tasks ──► CreateTaskUseCase ──► EventBus.publish(TaskCreated)
                                            │
                                            ▼
                                  NotifyOnTaskCreated (handler)
                                     ├─ repo.add(Notification)         → INSERT en Postgres (verdad)
                                     └─ broadcaster.publish(            → mensaje a Redis
                                          "notifications:user:ana",
                                          '{"type":"notification.new"}')
                                            │
                          ┌─────────────────┴─────────────────┐
                          ▼                                   ▼
                      Worker 1                            Worker 2
              (Ana conectada aquí, su                 (no tiene a Ana;
               _relay_loop está suscrito              ignora)
               al canal de Ana)
                          │
                          ▼
             ws.send_text('{"type":"notification.new"}')
                          │
                          ▼  (navegador de Ana, en cada pestaña abierta)
             ws.onmessage ─► queryClient.invalidateQueries(["notifications"])
                          │
                          ▼
             React Query re-hace GET /notifications  ─► 🔔 la campanita se actualiza
```

**Tres escalas de tiempo** que conviene no confundir:

```
Vida del worker    ████████████████████████████████  (horas/días)
Ana conectada           ████████████████             (minutos)
Un mensaje                     █                      (milisegundos)
```

---

## 4. Backend — las piezas y sus responsabilidades

Cada capa **no sabe qué hay encima**. El Broadcaster no sabe qué es un WebSocket;
el ConnectionManager no sabe qué es HTTP; el endpoint no sabe qué es Redis. Eso
es *hexagonal architecture* funcionando.

### 4.1 `Broadcaster` (puerto) — `shared/broadcasting/broadcaster.py`
ABC con 4 métodos async: `connect`, `disconnect`, `publish(channel, message)`,
`subscribe(channel) -> AsyncIterator[str]`. Es **plomería**: solo mueve strings,
no serializa ni enruta. Es también un *async context manager*
(`__aenter__`/`__aexit__`) para garantizar cleanup.

- **`InMemoryBroadcaster`** (`memory.py`): pub/sub con `asyncio.Queue` por
  suscriptor. Es un **patrón Observer**: `dict[str, list[Queue]]`. Sirve para
  tests y dev con 1 worker. El `subscribe` es un *async generator* con
  `try/finally` que limpia la cola y borra el canal vacío al cancelarse.
- **`RedisBroadcaster`** (`redis.py`): misma forma, pero `publish` → `redis.publish`
  y `subscribe` → `pubsub.listen()` filtrando `type == "message"`. Peculiaridad:
  una conexión en modo `SUBSCRIBE` queda dedicada (por eso existe el objeto
  `pubsub`). El `finally` cierra la suscripción incluso si Redis se cae
  (*exception shielding*: cada cleanup en su propio try/except).

### 4.2 `ConnectionManager` (singleton por worker) — `shared/connection_manager/`
Es la **recepción del hotel**: una por worker, mantiene el libro
`dict[str, list[WebSocket]]` (varias pestañas por canal) y
`dict[str, asyncio.Task]` (una task de relay por canal).

- `connect(channel, ws)`: registra la ws; si es la primera del canal, lanza
  `asyncio.create_task(_relay_loop(channel))`.
- `_relay_loop(channel)`: `async for msg in broadcaster.subscribe(channel)` y
  reparte a **una copia** de la lista de ws (evita "list changed size during
  iteration"); un `send` que falla no rompe a los demás.
- `disconnect(channel, ws)`: quita la ws; si era la última, `task.cancel()` +
  `await task`. **Muta el estado antes de esperar** → si entra un `connect`
  concurrente, ve el canal limpio y arranca uno nuevo sin carreras.
- `shutdown()`: `cancel()` a todas y `asyncio.gather(*tasks,
  return_exceptions=True)` para esperar el cleanup en paralelo.

> Cancelar la task dispara `CancelledError` dentro del `await`, que sube por el
> `async for` hasta el `finally` del `subscribe` → el cleanup de Redis ocurre
> **solo**, sin código extra. Ese es el premio de escribir bien el `finally`.

### 4.3 Endpoint WebSocket — `notifications/presentation/websocket.py`
Función simple (sin UseCase/Service — es *plumbing*, no dominio):
1. Lee `token` de `query_params`; valida con `decode_token` o cierra con `4401`.
2. `await ws.accept()`.
3. Lee el singleton con `ws.app.state.manager` (Starlette inyecta `.app`; **nunca**
   `from main import app` → evita imports circulares y facilita tests).
4. `manager.connect(channel, ws)`.
5. `while True: await ws.receive_text()` (mantiene viva la conexión) dentro de
   `try/except WebSocketDisconnect` + `finally: manager.disconnect(...)`.

### 4.4 Composition root — `lifespan` en `main.py`
Se ejecuta una vez al **arrancar/apagar cada worker**. Crea el `Broadcaster`
según settings (`USE_REDIS_AS_BROADCASTER`), hace `connect()`, instancia el
`ConnectionManager` y guarda ambos en `app.state`. En shutdown: `manager.shutdown()`
+ `broadcaster.disconnect()`. Es el **único** sitio que decide qué implementación
concreta usar.

### 4.5 Inyección al handler — `Depends`
`event_bus_dependency` depende de `get_broadcaster_from_request(request) ->
request.app.state.broadcaster`. FastAPI resuelve la cadena por request y arma el
bus con handlers que ya tienen el broadcaster. Los handlers publican **después**
del INSERT, con `try/except Exception` (best-effort: si Redis falla, la
notificación ya está persistida).

---

## 5. Frontend — el hook y React Query

### 5.1 Modelo mental de React
Un componente es **una función que se re-ejecuta muchas veces**. Por eso:
- **`useEffect(fn, deps)`**: efectos secundarios (abrir WS) — corre tras el
  render y solo cuando cambian las `deps`. El `return` es el **cleanup**
  (equivale al `shutdown` del lifespan, pero por componente).
- **`useRef`**: estado que **no** dispara re-render (la instancia del WS, timers,
  contadores). Si guardáramos el WS en `useState`, cada mensaje re-renderizaría
  y podría recrear la conexión.

### 5.2 `useNotificationsSocket` — `features/notifications/hooks/use-notification-socket.ts`
- Solo conecta si `isAuthenticated`. Lee el token con `readSession()` **dentro de
  `connect()`** (agarra siempre el más fresco tras un refresh).
- `ws.onmessage`: `JSON.parse`; si `type === "notification.new"` →
  `queryClient.invalidateQueries({ queryKey: ["notifications"] })`. **Esa es la
  única línea que toca la UI** — React Query re-fetchea y re-renderiza la
  campanita solo.
- `ws.onclose`: si `code === 4401` (token inválido) no reintenta; si no,
  **reconexión con backoff exponencial** (`2^intentos × 1000`, techo 30 s).
  `onopen` resetea el contador.
- Cleanup: marca `isUnmounted`, cancela el timer de reconexión pendiente y cierra
  la ws. Se monta una sola vez en `AppLayout`.

> **Callbacks vs async/await:** en el navegador todo corre en un solo hilo; un
> `while(true)` congelaría la página. Por eso la API `WebSocket` usa callbacks
> (`onmessage`, `onclose`), no un `await ws.recv()` como en asyncio. Registras
> funciones y el navegador te avisa.

### 5.3 Códigos de cierre (contrato con el front)
`1000` normal · `1001` server apagándose · `4401` token inválido/expirado (custom,
imita el 401 de HTTP). El front usa `evt.code` para decidir si reintenta o pide
re-login.

---

## 6. Escala horizontal — el punto clave

Cada worker es un **proceso** con memoria propia. Un `dict` en RAM no se comparte.
Con 2 workers detrás de nginx, Ana puede estar en el worker 1 y Bob en el 2. Si
el handler de Bob solo mirara el `ConnectionManager` local, **nunca** encontraría
a Ana. Redis pub/sub es el bus que **todos** los workers ven: cada worker se
suscribe en Redis a los canales de **sus** usuarios conectados, y `publish` llega
a quien tenga ese canal, esté en el worker que esté.

> Principio transferible: *el estado en memoria solo escala con 1 proceso*. En
> cuanto escalas horizontalmente (workers, réplicas, pods), necesitas un bus
> externo (Redis, NATS, Kafka…). Y *deja que la infraestructura haga su trabajo*:
> canales granulares en Redis en vez de un canal global filtrado en la app.

---

## 7. Testing (qué se prueba y dónde)

| Test | Qué valida |
|---|---|
| `tests/unit/shared/broadcasting/test_memory_broadcaster.py` | pub/sub, fan-out, no-op sin suscriptores, limpieza de canal |
| `tests/unit/shared/broadcasting/test_redis_broadcaster.py` | round-trip real (skip si no hay Redis), error si no conectado |
| `tests/unit/shared/connection_manager/test_connection_manager.py` | registro, relay, 2 pestañas, cancelación al desconectar, shutdown |
| `tests/unit/notifications/test_handlers_broadcast.py` | canal y mensaje correctos, no auto-notificarse |
| `tests/unit/shared/test_realtime_end_to_end.py` | cadena completa en memoria evento→ws + persistencia |
| `frontend/.../use-notification-socket.test.tsx` | abre WS, invalida cache en `notification.new`, ignora otros, cierra al desmontar |

> Nota: pytest solo colecta `test_*.py`. Los antiguos `use_cases.py` bajo
> `tests/unit/**` **no se ejecutan** — conviene renombrarlos a `test_*.py`.

Correr: backend `poetry run pytest tests/unit/shared tests/unit/notifications` ·
frontend `npx vitest run src/features/notifications`.
