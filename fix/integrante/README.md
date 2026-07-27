# Handoff: Vista de Integrantes (pantalla individual)

## Overview
Vista propia (no tab) para gestionar las personas con acceso al proyecto. Se navega desde el detalle del proyecto y se regresa con el breadcrumb superior — mismo patrón que Tareas/Estructura.

## About the Design File
`Proyecto Integrantes.dc.html` es un prototipo de referencia visual, a recrear con los componentes/datos reales del proyecto (roles, permisos y lógica de invitación ya existen en el codebase).

## Fidelity
Alta fidelidad visual; nombres, correos y roles son de ejemplo.

## Layout
### Header
Breadcrumb de vuelta + dark-mode. Ícono + "Integrantes" (26px/800) + subtítulo.

### Toolbar
Buscador + botón "Rol" (filtro) + spacer + botón sólido "+ Invitar integrante".

### Grid de integrantes (3 columnas, gap 16px)
Tarjeta por persona: avatar circular con iniciales (color por persona/rol) + indicador de estado (punto verde online / gris offline), nombre 14.5px/700, email 12.5px muted, menú "⋮". Footer con separador: badge de rol uppercase (color por tipo de rol) + contador de tareas asignadas.
Última celda del grid: tarjeta punteada "+ Invitar integrante" como acción rápida adicional.

## Interactions & Behavior
- Buscador filtra por nombre/correo en tiempo real.
- Filtro "Rol" (dropdown o popover) filtra la grid.
- "⋮" por tarjeta: cambiar rol, remover del proyecto, reenviar invitación (si pendiente).
- "Invitar integrante" (header o tarjeta punteada) abre flujo de invitación por correo con selector de rol.
- Roles son configurables por el sistema (no fijos) — el color de badge se resuelve igual que en Estructura (mapeo determinístico nombre→color).

## State Management
- `{id, name, email, avatarColor, status: online|offline, role, taskCount}[]`.
- Roles disponibles a nivel de organización/proyecto.

## Design Tokens
Mismo sistema visual que el resto del producto: fondo `oklch(97.3% 0.004 80)`, tarjetas `#fff`, borde `oklch(90% 0.005 80)`, acento índigo `oklch(50% 0.14 265)`, Manrope 400-800. Estado online: `oklch(62% 0.15 145)`.

## Assets
Ninguno externo — SVG inline.

## Files
- `Proyecto Integrantes.dc.html`
