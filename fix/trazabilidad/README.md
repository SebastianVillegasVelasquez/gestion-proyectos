# Handoff: Vista de Trazabilidad (pantalla individual)

## Overview
Vista propia (no tab) con el historial/bitácora de actividad del proyecto: quién hizo qué y cuándo.

## About the Design File
`Proyecto Trazabilidad.dc.html` es un prototipo visual de referencia; el registro real de eventos (audit log) usa la infraestructura de logging ya existente en el backend.

## Fidelity
Alta fidelidad visual; eventos, nombres y timestamps son de ejemplo.

## Layout
### Header
Breadcrumb + dark-mode. Ícono + "Trazabilidad" (26px/800) + subtítulo.

### Toolbar
Buscador + botón "Tipo de evento" (filtro) + botón "Rango de fecha".

### Timeline vertical (tarjeta única, `max-width:920px` — el detalle textual pide una columna angosta y legible)
Cada evento: círculo de ícono tintado por tipo de acción (completado=check verde, creado=+ índigo, editado=lápiz azul, añadido a equipo=personas gris) conectado por una línea vertical `oklch(91% 0.005 80)` al siguiente evento (mismo patrón de conector que el árbol de Estructura). Texto: actor en negrita + verbo + badge inline con el nombre del elemento afectado (color = tipo del elemento afectado, mismo mapeo que Estructura). Timestamp relativo/absoluto debajo, 12px muted.

## Interactions & Behavior
- Buscador filtra eventos por texto (actor, acción, elemento).
- Filtro "Tipo de evento" (creación/edición/completado/equipo/etc.), multi-select.
- Filtro "Rango de fecha" (date picker).
- Scroll infinito o paginación al fondo de la timeline para historiales largos.
- Click en el badge del elemento afectado navega a su vista correspondiente (nodo de Estructura, tarea, equipo).

## State Management
- `{id, actor:{name}, verb, targetType, targetName, targetRef, timestamp}[]`, ordenado desc por timestamp.
- Ícono/color por `verb` (completado/creado/editado/equipo/etc.) definido en un mapeo fijo de tipos de evento (no depende del dominio del proyecto).

## Design Tokens
Mismo sistema visual del producto: fondo `oklch(97.3% 0.004 80)`, tarjeta `#fff`, borde `oklch(90% 0.005 80)`, Manrope. Colores de ícono por tipo de evento: completado `oklch(38% 0.1 155)`/`oklch(94% 0.06 155)`, creado `oklch(40% 0.12 265)`/`oklch(94% 0.045 265)`, editado `oklch(45% 0.1 240)`/`oklch(95% 0.03 240)`, equipo `oklch(52% 0.01 260)`/`oklch(93% 0.004 80)`.

## Assets
Ninguno externo — SVG inline.

## Files
- `Proyecto Trazabilidad.dc.html`
