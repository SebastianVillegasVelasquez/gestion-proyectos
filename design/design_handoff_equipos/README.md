# Handoff: Vistas de Equipo (Tareas / Entregables / Configuración)

## Overview
Tres vistas para un gestor de proyectos por equipos: (1) tareas del equipo con dependencias y urgencia, (2) entregables con flujo de revisión/aprobación y comentarios, (3) configuración del equipo con roles, carga de trabajo, notificaciones y actividad.

## About the design file
`Bitacora OBJ - Equipos.dc.html` in this folder is an **HTML design reference/prototype** — not production code to copy directly. It shows layout, states, and interactions. Recreate it in the target codebase's existing framework/component library and design tokens, matching the app's current patterns (the app already has a dark sidebar + amber accent visual language — reuse those exact tokens/components rather than the raw inline styles in this file).

## Fidelity
High-fidelity for layout, states, and copy. Colors/spacing here are close approximations of the existing app (not extracted from its real CSS) — use the codebase's real tokens for accent amber, dark sidebar, status colors, and typography instead of the hex values below wherever the app already defines equivalents.

## Screens

### 1. Tareas del equipo
- Header: team name, member avatars (stacked, overlapping -8px), "+ Nueva tarea" button, tab row (Tareas del equipo / Entregables y Revisiones / Configuración del Grupo — active tab has amber 2px underline).
- View switch: segmented control "Lista" / "Kanban" (pill background #f0f0f2, active pill white bg).
- **Lista view**: tasks grouped by assignee (avatar + name + count header), each group is a bordered card containing rows. Row: title + module + optional dependency indicator (small dot–line–dot connector + "Bloqueada por: <task title>", truncated with ellipsis + title tooltip so it never overlaps neighboring columns) | progress bar (120px, colored by status) + % | due date (88px) | status badge (100px pill) | urgency badge (76px pill).
- **Kanban view**: 4 columns (Por hacer / En progreso / En revisión / Completada), each a card list; card shows title, assignee avatar, urgency badge, progress bar, due date, and the same truncated dependency indicator when blocked.
- Data per task: title, assignee, status (todo/progress/review/done), progress %, due date, urgency (baja/media/alta/critica), dependsOn (another task id), module/tag.

### 2. Entregables y Revisiones
Three-column layout inside one bordered panel:
- **Left (260px)**: "Entregables activos" list — each row: title, owner avatar+name, status pill (Borrador/En revisión/Cambios solicitados/Aprobado/Rechazado). Selected row highlighted (amber-tinted bg).
- **Center**: selected deliverable header (title, owner, related task, status pill) → "Línea de tiempo de entregas": vertical timeline (left border + dot per version) listing each submitted version (label V1/V2…, type chip Enlace/Documento/Imagen, date, URL link, note). Below: moderation actions — Aprobar / Solicitar cambios / Rechazar buttons, visible only to Líder/Supervisor; otherwise a locked note "Solo el líder o supervisor puede solicitar cambios o aprobar." Approve/reject/request-changes update the deliverable's status (this is the reject → resubmit flow the user asked for).
- **Right (300px)**: comment thread (author avatar, name, timestamp, text) + textarea + "Enviar" button, appends a new comment.

### 3. Configuración del Grupo
Two-column layout:
- **Left**: editable team name + description fields; members list (avatar, name, workload % with colored bar — green <60%, orange 60-84%, red ≥85%, role `<select>` Líder/Supervisor/Integrante, remove button), "+ Invitar" adds a member; "Zona de peligro" card with "Archivar equipo" button.
- **Right**: "Notificaciones del equipo" — toggle rows (nueva tarea asignada, entregable rechazado, comentario nuevo, entregable aprobado); "Actividad reciente" — timestamped event log feed.

## Interactions & Behavior
- Tab switching is local state, no navigation/route change needed unless the app already routes per tab.
- List/Kanban toggle is local state, default configurable.
- Selecting a deliverable in the left list updates the center/right panels.
- Approve/Reject/Request changes mutate deliverable status; in the real app these should also write an activity-log entry and (per notification settings) trigger a notification to the submitter.
- Role change on a member is a simple select; consider requiring at least one Líder to remain.
- All toggles/selects should be optimistic-update with a real API call in production.

## State Management (suggested)
- `activeTab`, `taskView` (ui-only local state)
- `team { name, description }`
- `members[] { id, name, initials, color, role, capacity }`
- `tasks[] { id, title, assigneeId, status, progress, dueDate, urgency, dependsOn, module }`
- `deliverables[] { id, title, ownerId, status, relatedTask, versions[], comments[] }`
- `notifications { key: boolean }`
- `activityLog[] { text, date, color }`
- `currentUserRole` — drives moderation-action visibility (should come from real auth/session, not a prop)

## Design tokens used in the reference
- Sidebar bg `#1b1b1f`, sidebar active item bg `#d6a13c` (amber accent), sidebar text `#e7e7ea` / muted `#8f8f99`
- Page bg `#ffffff`, borders `#ececef`, muted text `#9a9aa3`, body text `#16161b`
- Status colors: Por hacer `#6b7280`, En progreso `#2563b8`, En revisión `#7c5cd1`, Completada `#1f9d55`
- Urgency colors: Baja `#6b7280`, Media `#2563b8`, Alta `#d9770a`, Crítica `#d1453b` (bg = ~10% tint of each)
- Deliverable status colors: Borrador `#5b5b66`, En revisión `#2563b8`, Cambios solicitados `#b9660a`, Aprobado `#1f9d55`, Rechazado `#d1453b`
- Font: system sans stack (`-apple-system, "Segoe UI", Helvetica, Arial, sans-serif`)
- Border radius: 7-10px cards/inputs, 999px pills/badges/toggle tracks

**Prefer the app's real existing tokens for all of the above** — these are approximations reverse-engineered from screenshots, not the source of truth.

## Files
- `Bitacora OBJ - Equipos.dc.html` — full interactive reference (open in a browser).
