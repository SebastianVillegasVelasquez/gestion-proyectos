# Handoff: Pantalla de Proyecto (Estructura)

## Overview
Rediseño de la vista central del gestor de proyectos: el detalle de un proyecto, con foco en la pestaña "Estructura" (árbol de nodos Módulo/Curso/Tema), las tarjetas de acceso a Cronograma y Tareas, la barra de progreso, y la fila de compartir/tabs.

## About the Design Files
El archivo `Proyecto Estructura.dc.html` en esta carpeta es una **referencia de diseño en HTML** — un prototipo de alta fidelidad que muestra look & feel e interacciones esperadas, no código de producción para copiar tal cual. La tarea es **recrear este diseño en el stack React existente**, reutilizando los componentes, hooks y lógica de datos ya presentes en el proyecto (rutas, fetch de proyecto, tipos de nodo dinámicos, etc.). No se debe insertar HTML crudo ni estilos inline masivos en el codebase de producción — traducir a los patrones de componentes/CSS-in-JS/Tailwind (el que use el proyecto).

## Fidelity
**Alta fidelidad (hifi).** Colores, tipografía, espaciados e iconografía están definidos y deben respetarse. El único contenido de ejemplo (nombres de curso, fechas, porcentajes) es de demostración — usar los datos reales del backend.

## Screens / Views
Una sola vista: **Detalle de Proyecto → Tab Estructura**.

### 1. Header
- Breadcrumb "← Proyectos", link, 13px, font-weight 600, color `oklch(52% 0.01 260)`, ícono chevron-left 14px.
- Botón dark-mode: círculo 38px, borde 1px `oklch(90% 0.005 80)`, ícono luna 17px.
- Título proyecto: 30px, font-weight 800, letter-spacing -0.01em, color `oklch(22% 0.01 260)`.
- Meta row: ícono calendario 15px + rango de fechas + separador "·" + organización. 14px, font-weight 500, color `oklch(52% 0.01 260)`.

### 2. Tarjetas Cronograma / Tareas (grid 2 columnas, gap 18px)
Cada tarjeta: fondo blanco, borde 1px `oklch(90% 0.005 80)`, radius 18px, padding 22px 24px.
- Icono: cuadrado 46px, radius 13px, fondo tintado (Cronograma: ámbar `oklch(93% 0.05 70)` / Tareas: teal `oklch(92% 0.04 200)`).
- Título 16.5px/700, subtítulo 13.5px/500 color `oklch(52% 0.01 260)`.
- Botón flecha circular 34px, hover: fondo sólido color de acento + ícono blanco (transición 0.2s).
- Fila de mini-stats bajo un separador (`border-top` 1px `oklch(94% 0.004 80)`): puntos de color + texto 13px/600 (ej. "4 fases", "68 días" / "12 tareas", "5 pendientes").
- Hover de tarjeta completa: `box-shadow: 0 8px 24px oklch(20% 0.01 260 / 0.08)` + borde tintado al color de acento.

### 3. Progreso general
Tarjeta blanca, radius 18px. Label 14.5px/600 izquierda, porcentaje 20px/800 color ámbar `oklch(45% 0.13 70)` derecha. Barra: track 10px altura, radius 99px, fondo `oklch(94% 0.004 80)`; fill sólido `oklch(68% 0.13 70)` ancho = porcentaje. Caption inferior 12.5px color `oklch(58% 0.008 260)`.

### 4. Compartir con el cliente
Tarjeta blanca fila: icono cuadrado 42px tintado índigo `oklch(93% 0.03 265)`, título 15.5px/700 + subtítulo 13.5px/500. Botón sólido "Obtener enlace": fondo índigo `oklch(50% 0.14 265)`, texto blanco, radius 11px, padding 12px 20px, hover `oklch(43% 0.14 265)`.

### 5. Tabs
Fila con `border-bottom` 1px `oklch(90% 0.005 80)`. Tab activo ("Estructura"): texto índigo 14.5px/700 + borde inferior 2.5px índigo. Tabs inactivos: 14.5px/600 color `oklch(52% 0.01 260)`, hover a `oklch(30% 0.01 260)`. Cada tab con ícono 16px + label. Tabs: Estructura, Integrantes, Equipos de trabajo, Progreso por equipo, Trazabilidad.

### 6. Fila de Tipos + acción
Label "TIPOS" uppercase 11px/800 letter-spacing 0.08em. Chips de tipo (pill, borde 1.5px, fondo tintado según color del tipo — ver Design Tokens), chip dashed "+ nuevo" para crear tipos custom. A la derecha de la fila (flex:1 spacer): botón sólido "+ Añadir elemento" (mismo estilo que "Obtener enlace").

### 7. Árbol de Estructura (nodos)
Tarjeta blanca, radius 18px, `overflow:hidden`.
- Cada fila: chevron (solo si tiene hijos, 22px), punto de color 6-8px, badge de tipo (pill 11px/800 uppercase, colores por tipo), nombre (peso/tamaño decrece por profundidad: depth0 15px/700, depth1 14.5px/600, depth2 14px/500), spacer flexible, rango de fechas (13px/600, tabular-nums, color `oklch(56% 0.008 260)`), pill de duración (fondo gris `oklch(95% 0.004 80)`).
- **Líneas conectoras**: cada nivel de hijos vive en un contenedor con `border-left: 1.5px solid oklch(91% 0.005 80)` y `padding-left: 16px`; cada fila hija tiene un pseudo-elemento (`::before`) de 16px de ancho, 1.5px alto, mismo color, posicionado a `left:-16px; top:50%` para conectar la fila con la línea vertical del padre. Esto genera el efecto de árbol tipo Linear/Notion.
- Hover de fila: fondo `oklch(97.5% 0.003 80)`.
- Separadores `border-bottom` 1px `oklch(94% 0.004 80)` entre grupos de nivel raíz.

### 8. Botón flotante Feedback
Fixed bottom-right, pill, fondo índigo, ícono chat 15px, shadow `0 8px 20px oklch(20% 0.01 260 / 0.18)`.

## Interactions & Behavior
- Hover states en tarjetas, botones, filas de árbol y tabs (ver arriba).
- Chevron de fila con hijos indica expandir/colapsar (el prototipo lo muestra siempre expandido; implementar toggle real con estado de expansión por nodo, persistente si es posible).
- Chips de "TIPOS" son filtros/toggle de visibilidad por tipo de nodo; "+ nuevo" abre creación de tipo custom (nombre + color).
- "Añadir elemento" abre flujo de creación de nodo en el árbol (con selector de tipo y padre).
- Los tipos de nodo son **dinámicos** (el usuario puede crear tipos con cualquier nombre) — implementar asignación de color determinística por tipo (hash del nombre → paleta curada de 5-6 tonos oklch a misma chroma/lightness, variando hue), no colores hardcodeados por tipo fijo.

## State Management
- Árbol de nodos: estructura recursiva `{id, name, type, startDate, endDate, durationDays, children[], expanded}`.
- Estado de expansión por nodo (Set de ids expandidos o campo `expanded` por nodo).
- Lista de tipos custom: `{name, color}[]`, persistidos a nivel proyecto.
- Progreso general: derivado (elementos completados / total).

## Design Tokens

**Colores base**
- Fondo página: `oklch(97.3% 0.004 80)`
- Tarjetas: `#fff`
- Borde: `oklch(90% 0.005 80)`
- Texto primario: `oklch(22% 0.01 260)`
- Texto secundario: `oklch(52% 0.01 260)`
- Texto terciario/muted: `oklch(56-58% 0.008 260)`

**Acento principal (botones, tabs activos, links)**: índigo `oklch(50% 0.14 265)`, hover `oklch(43% 0.14 265)`

**Acentos de tarjeta**: ámbar `oklch(45-68% 0.13 70)` (Cronograma/progreso), teal `oklch(42-58% 0.08-0.09 200)` (Tareas)

**Paleta de tipos de nodo** (chroma ~0.045-0.13, lightness ~0.94 fondo / ~0.38-0.45 texto, variando hue):
- Módulo: hue 265 (índigo)
- Curso: hue 155 (verde)
- Tema: hue 305 (violeta)
- (tipos adicionales: rotar hues ~40-60° para nuevos tipos custom)

**Tipografía**: Manrope (400/500/600/700/800), Google Fonts. Fallback `system-ui, sans-serif`.

**Radios**: cards 18px, botones 10-11px, chips 6px (badges) / 99px (pills).

## Assets
Ningún asset externo — todos los íconos son SVG inline simples (stroke-based, 14-21px). No hay imágenes.

## Files
- `Proyecto Estructura.dc.html` — prototipo completo de la vista.
