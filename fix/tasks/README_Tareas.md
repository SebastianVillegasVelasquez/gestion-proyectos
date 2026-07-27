# Handoff: Vista de Tareas (Kanban por proyecto)

## Overview
Tablero kanban de tareas del proyecto, 4 columnas de estado: Pendiente, En progreso, En revisión, Completada. Reemplaza la vista anterior (lista plana de 4 columnas estilo Bootstrap) por tarjetas enriquecidas y un header con búsqueda/filtros/toggle de vista.

## About the Design Files
`Proyecto Tareas.dc.html` es un **prototipo HTML de referencia**, no código para copiar tal cual. Recrear en los componentes React del proyecto, reutilizando drag-and-drop, fetch de tareas y lógica de estado ya existentes.

## Fidelity
Alta fidelidad. Colores, tipografía, spacing e iconografía definidos. Contenido de tarjetas (nombres, fechas, iniciales) es de ejemplo — usar datos reales.

## Screens / Views
Una vista: **Tareas del proyecto (kanban)**.

### Header
- Breadcrumb al proyecto (13px/600).
- Botón dark-mode (círculo 38px) + botón sólido "+ Nueva tarea" (único punto de creación de tarea — no hay botones de "añadir tarea" dentro de columnas).
- Título "Tareas" (26px/800) con ícono check.
- Barra de búsqueda (pill, ícono lupa), botón "Filtros", toggle de vista kanban/lista (grupo de 2 botones, activo = fondo índigo).

### Columnas (grid 4 columnas, gap 16px, responsive `minmax(0,1fr)` — sin ancho mínimo fijo ni scroll horizontal del board)
Header de columna: punto de color de estado + label 14.5px/700 + badge contador (pill, fondo tintado al color del estado) + spacer + botón "+" pequeño (26px) para crear tarea directo en esa columna.

Colores de estado:
- Pendiente: gris `oklch(65% 0.01 260)`
- En progreso: índigo `oklch(58% 0.14 265)`
- En revisión: ámbar `oklch(68% 0.13 70)`
- Completada: verde `oklch(58% 0.13 155)`

### Tarjeta de tarea
Fondo blanco, borde 1px, radius 14px, padding 15px 16px, `cursor:grab` (drag handle visual).
- Fila superior: badge de prioridad (ALTA rojo / MEDIA azul / BAJA verde, o "LISTA" con check para completadas) + menú "⋮".
- Título 14.5px/700 (tachado + color atenuado si está completada).
- Descripción opcional 12.5px/500 color secundario (2 líneas).
- Tag de ubicación en el árbol (Módulo/Curso/Tema) — mismo color que su badge en la vista de Estructura, para consistencia visual entre pantallas.
- Barra de progreso opcional (label "Progreso" + %, track 6px + fill índigo) — solo en tareas "En progreso" con subtareas.
- Avatares apilados (círculo 24px, iniciales, borde blanco 2px, `margin-left:-8px` para solape) cuando hay múltiples responsables.
- Footer (separador `border-top` 1px): fecha con ícono calendario izquierda; derecha = contador de subtareas (ícono check + "0/3") y/o contador de comentarios (ícono chat) y/o avatar único del responsable. En "En revisión" puede mostrar estado "En espera" en vez de avatar.
- Hover: `box-shadow: 0 6px 18px oklch(20% 0.01 260 / 0.07)` + borde `oklch(82% 0.01 260)`.
- Tarjeta "En progreso" destacada: borde `oklch(88% 0.02 265)` + shadow sutil índigo en reposo (indica foco actual).

## Interactions & Behavior
- Drag & drop de tarjeta entre columnas → actualiza estado de la tarea.
- Único CTA de creación: botón "+ Nueva tarea" del header (abre modal/panel con selección de estado inicial, prioridad, ubicación en árbol, responsables, fecha). El botón "+" pequeño de cada columna header crea directamente con ese estado preseleccionado. **No hay botón de añadir tarea al pie de cada columna.**
- Búsqueda filtra tarjetas visibles en tiempo real.
- Toggle kanban/lista cambia el layout completo (lista = tabla densa, ver sección Escalabilidad).
- Menú "⋮" por tarjeta: editar, mover, eliminar, duplicar.
- Click en tarjeta abre detalle/edición completa.

## Escalabilidad (100+ tareas por proyecto)
Implementar antes de producción si el volumen de tareas es alto:
- Cada columna con `max-height` fija (viewport menos header) y **scroll interno propio** — nunca scroll horizontal del board completo.
- Paginación o "cargar más" dentro de columna (~20 tarjetas por carga) en vez de renderizar todo de una vez.
- Filtros robustos: por responsable, prioridad, módulo/curso/tema, rango de fecha.
- Badge de contador con estado visual de alerta (color distinto) si la columna supera un umbral (ej. cuello de botella en "En progreso").
- Vista de lista/tabla (toggle ya incluido en el header) como alternativa más densa y ordenable por columna para volumen alto.
- Modo "compacto" opcional: tarjeta reducida (sin descripción/progreso) cuando hay muchas tareas visibles.

## State Management
- Tarea: `{id, title, description?, priority: alta|media|baja, status: pendiente|en_progreso|en_revision|completada, treeNodeId (ref a nodo de Estructura), treeNodeType, assignees[], dueDate, subtasks: {done,total}, comments: number, progress?: 0-100}`.
- Conteo por columna derivado de `tasks.filter(status)`.
- El color del tag de ubicación se resuelve igual que en la vista de Estructura (mismo mapeo tipo→color) para consistencia cross-screen.

## Design Tokens
Mismos tokens que la vista de Estructura (ver `README.md` del paquete de Estructura): fondo `oklch(97.3% 0.004 80)`, tarjetas `#fff`, borde `oklch(90% 0.005 80)`, acento índigo `oklch(50% 0.14 265)`, tipografía Manrope.

**Colores de prioridad**: Alta `oklch(45% 0.15 30)` sobre `oklch(94% 0.08 30)`; Media `oklch(45% 0.1 240)` sobre `oklch(94% 0.03 240)`; Baja `oklch(42% 0.06 155)` sobre `oklch(95% 0.02 155)`.

## Assets
Ningún asset externo, íconos SVG inline stroke-based.

## Files
- `Proyecto Tareas.dc.html` — prototipo completo del kanban.
