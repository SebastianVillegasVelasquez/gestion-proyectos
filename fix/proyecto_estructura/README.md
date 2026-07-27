# Handoff: Vista de Estructura (pantalla individual)

## Overview
La "Estructura" deja de ser una pestaña dentro del detalle del proyecto y pasa a ser **su propia vista**, accesible desde la tarjeta "Cronograma"-equivalente en el detalle del proyecto (patrón: navegación a nueva vista, no tab ni nueva pestaña del navegador — igual que la vista de Tareas ya implementada). El botón "Volver" regresa al detalle del proyecto.

## About the Design File
`Proyecto Estructura.dc.html` es un **prototipo HTML de referencia**, no código para copiar tal cual. Recrear con los componentes/routing React existentes del proyecto (el codebase ya conoce el dominio; no se documentan aquí reglas de negocio, solo la interfaz).

## Fidelity
Alta fidelidad visual. Contenido (nombres de fase/módulo, fechas, duraciones) es de ejemplo.

## Layout
### Header
Breadcrumb "← Diplomado en Transformación Digital" (vuelve al detalle del proyecto) + botón dark-mode. Debajo: ícono + título "Estructura del proyecto" (26px/800) + subtítulo descriptivo.

### Toolbar
Fila con: buscador (pill, ícono lupa), toggle de vista "Árbol / Lista" (grupo de 2, activo con fondo índigo), botón "Colapsar todo" / "Expandir todo", spacer, botón sólido "+ Añadir elemento" a la derecha.

### Fila de Tipos
Label "TIPOS" + chips de tipo (pill, borde 1.5px, colores por tipo — ver tokens) + chip punteado "+ nuevo" para crear un tipo custom con nombre y color propios.

### Árbol de nodos
Tarjeta blanca `radius:18px`, `overflow:hidden`. Cada fila: chevron (solo si tiene hijos), punto de color, badge de tipo uppercase, nombre (peso decrece por profundidad), spacer, rango de fechas o "sin fechas" en itálica muted si no tiene, pill de duración.

**Conectores de árbol**: cada nivel de hijos vive en un contenedor `border-left:1.5px solid oklch(91% 0.005 80)` + `padding-left:16px`; cada fila hija tiene un segmento horizontal de 16px que la conecta a la línea vertical del padre (efecto tipo Notion/Linear).

Hover de fila: fondo `oklch(97.5% 0.003 80)`.

## Interactions & Behavior
- Chevron expande/colapsa un nodo con hijos; "Expandir/Colapsar todo" actúa sobre todo el árbol.
- Toggle Árbol/Lista cambia el layout (Lista = tabla plana ordenable, sin jerarquía visual, para volumen alto de nodos).
- Chips de "Tipos" filtran/atenúan nodos que no coinciden.
- "+ Añadir elemento" abre creación de nodo (nombre, tipo, padre, fechas).
- Tipos de nodo son dinámicos y definidos por el usuario (nombre + color), asignar color de forma determinística por nombre (hash → paleta oklch de 5-6 hues) para tipos no predefinidos.
- Buscador filtra nodos por nombre en tiempo real, expandiendo automáticamente los ancestros de un match.

## State Management
- Árbol recursivo: `{id, name, type, startDate?, endDate?, durationDays?, children[], expanded}`.
- Tipos custom: `{name, color}[]` a nivel proyecto.
- Estado de expansión por nodo (Set de ids o campo `expanded`).

## Design Tokens
Fondo página `oklch(97.3% 0.004 80)`, tarjetas `#fff`, borde `oklch(90% 0.005 80)`, texto primario `oklch(22% 0.01 260)`, acento índigo `oklch(50% 0.14 265)` (hover `oklch(43% 0.14 265)`). Tipografía Manrope 400-800.

**Colores de tipo** (chroma ~0.045-0.13, fondo ~94% lightness, texto ~38-45% lightness, variando hue): Fase → hue 155 (verde), Módulo → hue 265 (índigo). Nuevos tipos custom: rotar hue en pasos de ~40-60°.

## Assets
Ninguno externo — íconos SVG inline stroke-based.

## Files
- `Proyecto Estructura.dc.html`
