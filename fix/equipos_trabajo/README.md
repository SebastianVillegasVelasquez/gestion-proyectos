# Handoff: Vista de Equipos de Trabajo (pantalla individual)

## Overview
Vista propia (no tab) para gestionar equipos/subgrupos de integrantes dentro del proyecto. Navegación a vista completa, no modal ni pestaña.

## About the Design File
`Proyecto Equipos de Trabajo.dc.html` es un prototipo visual de referencia; recrear con la lógica de equipos ya existente (asignación a módulos, miembros, permisos).

## Fidelity
Alta fidelidad visual; nombres de equipo, avatares y progreso son de ejemplo.

## Layout
### Header
Breadcrumb + dark-mode. Ícono + "Equipos de trabajo" (26px/800) + subtítulo.

### Toolbar
Buscador + spacer + botón sólido "+ Crear equipo".

### Grid de equipos (2 columnas, gap 16px)
Tarjeta por equipo: ícono cuadrado tintado (color propio del equipo) + nombre 15.5px/700 + referencia a su ubicación en la estructura (ej. "Módulo 1 · Unidad 1") + menú "⋮". Avatares apilados de miembros (stack con solape -8px, "+N" si hay más de 2 visibles). Barra de progreso mini con label "Progreso" + %.
Última celda: tarjeta punteada "+ Crear equipo".

## Interactions & Behavior
- "⋮" por tarjeta: editar equipo, añadir/quitar miembros, eliminar.
- Click en tarjeta abre detalle del equipo (miembros completos, tareas asignadas).
- "Crear equipo" abre formulario: nombre, color, miembros, nodo de estructura asociado (opcional).
- El progreso se deriva de las tareas asignadas al equipo (completadas/total).

## State Management
- `{id, name, color, treeNodeRef?, members: [{id,name,avatarColor}], progress: 0-100}[]`.

## Design Tokens
Mismo sistema: fondo `oklch(97.3% 0.004 80)`, tarjetas `#fff`, borde `oklch(90% 0.005 80)`, acento índigo `oklch(50% 0.14 265)`, Manrope. Colores de equipo: misma paleta determinística por nombre usada en Estructura/Integrantes, para reconocer un equipo cross-pantalla.

## Assets
Ninguno externo — SVG inline.

## Files
- `Proyecto Equipos de Trabajo.dc.html`
