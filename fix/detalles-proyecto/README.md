# Handoff: Detalle del Proyecto (rediseño)

## Overview
Rediseño del detalle de proyecto: se elimina el bloque inferior de tabs + árbol embebido (Estructura ya no vive aquí). En su lugar, un panel "Secciones del proyecto" da acceso a las 5 vistas individuales ya construidas (Estructura, Integrantes, Equipos de trabajo, Progreso por equipo, Trazabilidad), cada una navegando a su propia pantalla — no tabs, no nueva pestaña del navegador.

## About the Design File
`Proyecto Detalle.dc.html` es un prototipo visual de referencia; recrear con el routing y datos reales del proyecto.

## Fidelity
Alta fidelidad visual. Conteos (7 elementos, 3 personas, 2 equipos) son de ejemplo.

## Layout
Grid de 2 columnas (`1.7fr / 1fr`):
- **Columna izquierda**: tarjetas Cronograma/Tareas, Progreso general, Compartir con el cliente (sin cambios respecto al diseño previo).
- **Columna derecha**: panel "Secciones del proyecto" (`position:sticky`), lista vertical de 5 filas-link. Cada fila: ícono cuadrado tintado (mismo color que su vista dedicada), título 14px/700, meta descriptiva 12px muted, chevron a la derecha. Hover: fondo `oklch(97% 0.004 80)`.

## Variante sugerida: menú desplegable
En vez de panel fijo, "Secciones del proyecto" puede implementarse como **menú desplegable** (dropdown/popover) anclado a un botón en el header del proyecto (ej. junto al título o al ícono de dark-mode) — recomendable en breakpoints angostos o si se prefiere una cabecera más compacta. El contenido interno (filas con ícono + título + meta + chevron) es el mismo; solo cambia el contenedor: popover flotante con sombra en vez de tarjeta sticky en columna. Mantener el mismo ancho (~280-320px) y transición de apertura suave (fade + scale sutil).

## Interactions & Behavior
- Cada fila navega a su vista dedicada (Estructura, Integrantes, Equipos de trabajo, Progreso por equipo, Trazabilidad) — vistas ya entregadas en handoffs separados.
- Meta descriptiva por sección es dinámica (conteo real desde backend).
- Si se opta por dropdown: abre al click, cierra al seleccionar o click fuera; teclado (Esc cierra, flechas navegan).

## Design Tokens
Mismo sistema visual del producto: fondo `oklch(97.3% 0.004 80)`, tarjetas `#fff`, borde `oklch(90% 0.005 80)`, acento índigo `oklch(50% 0.14 265)`, Manrope 400-800. Colores de ícono por sección reutilizan los tokens ya usados en cada vista dedicada (Estructura=verde/índigo, Integrantes=índigo, Equipos=verde, Progreso=teal, Trazabilidad=gris neutro).

## Assets
Ninguno externo — SVG inline.

## Files
- `Proyecto Detalle.dc.html`
