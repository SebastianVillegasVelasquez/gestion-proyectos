// Aplana el árbol de la estructura (WorkItemTree) en una lista ordenada de filas
// para el cronograma. Cada nodo se convierte en una fila con su rango agregado
// (rollup de todo su subárbol) y sus tareas cuelgan como filas hijas. Puro: sin
// React ni red, para poder razonarlo y testearlo en aislamiento.

import type { DatedTask } from "./task";
import type { WorkItemTree } from "../types/api.types";

/** Rango de fechas (ISO YYYY-MM-DD) agregado sobre un subárbol. */
export interface DateSpan {
  start: string;
  due: string;
}

/** Fila de nodo: un elemento de la estructura con su barra resumen. */
export interface GanttNodeRow {
  kind: "node";
  id: string;
  name: string;
  tipoId: string;
  /** Profundidad en el árbol (0 = raíz) → sangría en la columna de etiquetas. */
  depth: number;
  /** Rango agregado sobre todo el subárbol (plan del nodo + tareas + hijos). */
  start: string;
  due: string;
  /** Tareas fechadas del subárbol y cuántas están completadas (badge x/y). */
  taskCount: number;
  doneCount: number;
  /**
   * Es un "padre": tiene nodos hijos visibles. Solo los padres se pueden
   * colapsar; las hojas (p. ej. una Unidad con tareas) no son colapsables —
   * sus tareas se ocultan con el toggle global "Tareas", no fila por fila.
   */
  hasChildren: boolean;
}

/** Fila de tarea: cuelga de su elemento, una profundidad más adentro. */
export interface GanttTaskRow {
  kind: "task";
  id: string;
  depth: number;
  task: DatedTask;
}

export type GanttRow = GanttNodeRow | GanttTaskRow;

export interface BuildRowsParams {
  tree: WorkItemTree[];
  /** Tareas fechadas ya filtradas, agrupadas por work_item_id. */
  tasksByItem: Map<string, DatedTask[]>;
  /** Nodos colapsados: sus hijos no se emiten como filas. */
  isCollapsed: (id: string) => boolean;
  /** Mostrar las tareas como filas hijas (si no, solo la jerarquía de nodos). */
  showTasks: boolean;
  /** Tipos activos; vacío = todos. Se conservan los ancestros de un match. */
  activeTypeIds: Set<string>;
}

const minIso = (a: string, b: string) => (a < b ? a : b);
const maxIso = (a: string, b: string) => (a > b ? a : b);

function mergeSpan(acc: DateSpan | null, span: DateSpan | null): DateSpan | null {
  if (!acc) {
    return span;
  }
  if (!span) {
    return acc;
  }
  return { start: minIso(acc.start, span.start), due: maxIso(acc.due, span.due) };
}

interface Subtree {
  /** Filas visibles de este nodo y sus descendientes (respeta colapso). */
  rows: GanttRow[];
  /** Rango agregado del subárbol (ignora colapso: la barra siempre lo abarca). */
  span: DateSpan | null;
  taskCount: number;
  doneCount: number;
  /** El nodo o algún descendiente coincide con el filtro de tipos. */
  typeMatch: boolean;
}

function visit(node: WorkItemTree, depth: number, params: BuildRowsParams): Subtree {
  const { tasksByItem, isCollapsed, showTasks, activeTypeIds } = params;
  const directTasks = tasksByItem.get(node.id) ?? [];

  // Punto de partida del rango: el plan del propio nodo, si lo tiene.
  let span: DateSpan | null =
    node.fecha_inicio_plan && node.fecha_fin_plan
      ? { start: node.fecha_inicio_plan, due: node.fecha_fin_plan }
      : null;
  let taskCount = 0;
  let doneCount = 0;
  let typeMatch = activeTypeIds.size === 0 || activeTypeIds.has(node.tipo_id);

  const childResults = node.children.map((child) => visit(child, depth + 1, params));
  for (const child of childResults) {
    span = mergeSpan(span, child.span);
    taskCount += child.taskCount;
    doneCount += child.doneCount;
    if (child.typeMatch) {
      typeMatch = true;
    }
  }
  for (const t of directTasks) {
    span = mergeSpan(span, { start: t.start_date, due: t.due_date });
    taskCount += 1;
    if (t.status === "completada") {
      doneCount += 1;
    }
  }

  // Sin fechas en todo el subárbol, o podado por el filtro de tipos: no aporta
  // filas ni contamina el rango del ancestro.
  if (!span || !typeMatch) {
    return { rows: [], span: null, taskCount, doneCount, typeMatch };
  }

  const childRows = childResults.flatMap((c) => c.rows);
  const taskRows: GanttTaskRow[] = showTasks
    ? directTasks.map((task) => ({ kind: "task", id: task.id, depth: depth + 1, task }))
    : [];
  // Solo es padre (colapsable) si tiene nodos hijos visibles. Una hoja con
  // tareas no lo es: colapsarla no debe ocultar sus tareas.
  const hasChildren = childRows.length > 0;

  const rows: GanttRow[] = [
    {
      kind: "node",
      id: node.id,
      name: node.nombre,
      tipoId: node.tipo_id,
      depth,
      start: span.start,
      due: span.due,
      taskCount,
      doneCount,
      hasChildren,
    },
  ];
  // Solo los padres responden al colapso; las hojas siempre muestran sus tareas.
  if (!hasChildren || !isCollapsed(node.id)) {
    rows.push(...childRows, ...taskRows);
  }
  return { rows, span, taskCount, doneCount, typeMatch: true };
}

/** Aplana el árbol en filas ordenadas (DFS) para renderizar el cronograma. */
export function buildGanttRows(params: BuildRowsParams): GanttRow[] {
  return params.tree.flatMap((node) => visit(node, 0, params).rows);
}

/**
 * Spans de las fechas plan de todos los nodos. Se suman a las tareas para que el
 * eje de tiempo cubra la estructura completa aunque aún no existan tareas.
 */
export function collectPlanSpans(tree: WorkItemTree[]): { start_date: string; due_date: string }[] {
  const spans: { start_date: string; due_date: string }[] = [];
  const walk = (nodes: WorkItemTree[]) => {
    for (const node of nodes) {
      if (node.fecha_inicio_plan && node.fecha_fin_plan) {
        spans.push({ start_date: node.fecha_inicio_plan, due_date: node.fecha_fin_plan });
      }
      walk(node.children);
    }
  };
  walk(tree);
  return spans;
}
