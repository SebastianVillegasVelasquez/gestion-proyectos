import { describe, it, expect } from "vitest";
import { buildGanttRows, collectPlanSpans, type GanttRow } from "./tree";
import type { DatedTask } from "./task";
import type { WorkItemTree } from "../types/api.types";

// ── Fábricas mínimas ─────────────────────────────────────────────────────────

function node(over: Partial<WorkItemTree> & { id: string }): WorkItemTree {
  return {
    proyecto_id: "p1",
    parent_id: null,
    tipo_id: "curso",
    nombre: over.id,
    orden: 0,
    prioridad: null,
    fecha_inicio_plan: null,
    fecha_fin_plan: null,
    duracion_valor: null,
    duracion_unidad: null,
    fecha_inicio_real: null,
    fecha_fin_real: null,
    porcentaje_completado: null,
    es_transversal: false,
    advertencia_fechas: false,
    conflicto_fechas: false,
    children: [],
    ...over,
  };
}

function task(over: Partial<DatedTask> & { id: string; work_item_id: string }): DatedTask {
  return {
    project_id: "p1",
    parent_task_id: null,
    title: over.id,
    description: null,
    priority: "no_definida",
    assignee_id: null,
    team_id: null,
    start_date: "2026-01-01",
    due_date: "2026-01-10",
    status: "pendiente_por_iniciar",
    completed_at: null,
    estimated_days: null,
    logged_days: "0",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: null,
    orden: 0,
    represents_work_item: false,
    requires_approval: false,
    progress_pct: 0,
    assignee_name: null,
    ...over,
  };
}

function groupTasks(tasks: DatedTask[]): Map<string, DatedTask[]> {
  const map = new Map<string, DatedTask[]>();
  for (const t of tasks) {
    const arr = map.get(t.work_item_id!) ?? [];
    arr.push(t);
    map.set(t.work_item_id!, arr);
  }
  return map;
}

function build(over: Partial<Parameters<typeof buildGanttRows>[0]>): GanttRow[] {
  return buildGanttRows({
    tree: [],
    tasksByItem: new Map(),
    isCollapsed: () => false,
    showTasks: true,
    activeTypeIds: new Set(),
    ...over,
  });
}

describe("buildGanttRows", () => {
  it("mirrors the tree hierarchy with depth per level", () => {
    const tree = [
      node({
        id: "curso",
        fecha_inicio_plan: "2026-01-01",
        fecha_fin_plan: "2026-03-01",
        children: [
          node({ id: "modulo", fecha_inicio_plan: "2026-01-05", fecha_fin_plan: "2026-02-01" }),
        ],
      }),
    ];
    const rows = build({ tree });
    expect(rows.map((r) => [r.kind, r.id, r.depth])).toEqual([
      ["node", "curso", 0],
      ["node", "modulo", 1],
    ]);
  });

  it("rolls up a node's range over its whole subtree", () => {
    const tree = [
      node({
        id: "curso",
        children: [node({ id: "modulo" })],
      }),
    ];
    const tasks = [
      task({ id: "t1", work_item_id: "modulo", start_date: "2026-02-01", due_date: "2026-02-10" }),
      task({ id: "t2", work_item_id: "modulo", start_date: "2026-01-15", due_date: "2026-01-20" }),
    ];
    const [curso] = build({ tree, tasksByItem: groupTasks(tasks) });
    expect(curso.kind).toBe("node");
    if (curso.kind === "node") {
      expect(curso.start).toBe("2026-01-15");
      expect(curso.due).toBe("2026-02-10");
      expect(curso.taskCount).toBe(2);
    }
  });

  it("nests tasks under their node and counts completed ones", () => {
    const tree = [node({ id: "unidad" })];
    const tasks = [
      task({ id: "t1", work_item_id: "unidad", status: "completada" }),
      task({ id: "t2", work_item_id: "unidad" }),
    ];
    const rows = build({ tree, tasksByItem: groupTasks(tasks) });
    expect(rows.map((r) => r.kind)).toEqual(["node", "task", "task"]);
    const unidad = rows[0];
    if (unidad.kind === "node") {
      expect(unidad.doneCount).toBe(1);
      expect(unidad.taskCount).toBe(2);
    }
  });

  it("marks only nodes with child nodes as collapsible (leaves are not fathers)", () => {
    const tree = [node({ id: "curso", children: [node({ id: "unidad" })] })];
    const tasks = [task({ id: "t1", work_item_id: "unidad" })];
    const rows = build({ tree, tasksByItem: groupTasks(tasks) });
    const curso = rows.find((r) => r.id === "curso");
    const unidad = rows.find((r) => r.id === "unidad");
    // El curso tiene un nodo hijo → padre colapsable; la unidad solo tiene
    // tareas → hoja, no colapsable aunque las muestre.
    expect(curso?.kind === "node" && curso.hasChildren).toBe(true);
    expect(unidad?.kind === "node" && unidad.hasChildren).toBe(false);
  });

  it("never hides a leaf's tasks even if the leaf id is marked collapsed", () => {
    const tree = [node({ id: "unidad" })];
    const tasks = [task({ id: "t1", work_item_id: "unidad" })];
    const rows = build({
      tree,
      tasksByItem: groupTasks(tasks),
      isCollapsed: (id) => id === "unidad",
    });
    expect(rows.map((r) => r.id)).toEqual(["unidad", "t1"]);
  });

  it("omits task rows when showTasks is false but keeps the node bar", () => {
    const tree = [node({ id: "unidad" })];
    const tasks = [task({ id: "t1", work_item_id: "unidad" })];
    const rows = build({ tree, tasksByItem: groupTasks(tasks), showTasks: false });
    expect(rows.map((r) => r.kind)).toEqual(["node"]);
  });

  it("hides descendants of a collapsed node", () => {
    const tree = [node({ id: "curso", children: [node({ id: "modulo" })] })];
    const tasks = [task({ id: "t1", work_item_id: "modulo" })];
    const rows = build({
      tree,
      tasksByItem: groupTasks(tasks),
      isCollapsed: (id) => id === "curso",
    });
    expect(rows.map((r) => r.id)).toEqual(["curso"]);
  });

  it("drops nodes that have no dates anywhere in their subtree", () => {
    const tree = [node({ id: "vacio", children: [node({ id: "hijo-sin-fechas" })] })];
    expect(build({ tree })).toHaveLength(0);
  });

  it("keeps a node and its ancestors when the type filter matches a descendant", () => {
    const tree = [
      node({
        id: "curso",
        tipo_id: "curso",
        children: [
          node({ id: "unidad", tipo_id: "unidad" }),
          node({ id: "otro", tipo_id: "modulo" }),
        ],
      }),
    ];
    const tasks = [
      task({ id: "t1", work_item_id: "unidad" }),
      task({ id: "t2", work_item_id: "otro" }),
    ];
    const rows = build({
      tree,
      tasksByItem: groupTasks(tasks),
      activeTypeIds: new Set(["unidad"]),
    });
    // El curso (ancestro) se conserva; la unidad coincide; el módulo se poda.
    expect(rows.filter((r) => r.kind === "node").map((r) => r.id)).toEqual(["curso", "unidad"]);
  });
});

describe("collectPlanSpans", () => {
  it("collects plan ranges from every node that has both dates", () => {
    const tree = [
      node({
        id: "a",
        fecha_inicio_plan: "2026-01-01",
        fecha_fin_plan: "2026-02-01",
        children: [
          node({ id: "b", fecha_inicio_plan: "2026-01-10", fecha_fin_plan: "2026-01-20" }),
        ],
      }),
      node({ id: "c" }), // sin fechas → se ignora
    ];
    expect(collectPlanSpans(tree)).toEqual([
      { start_date: "2026-01-01", due_date: "2026-02-01" },
      { start_date: "2026-01-10", due_date: "2026-01-20" },
    ]);
  });
});

describe("buildGanttRows · onlyWithTasks (cronograma recortado a un equipo)", () => {
  // Estructura: raíz → [conTareas (1 tarea), sinTareas (0 tareas, con fechas)]
  const conTareas = node({
    id: "conTareas",
    fecha_inicio_plan: "2026-01-01",
    fecha_fin_plan: "2026-01-31",
  });
  const sinTareas = node({
    id: "sinTareas",
    fecha_inicio_plan: "2026-02-01",
    fecha_fin_plan: "2026-02-28",
  });
  const raiz = node({
    id: "raiz",
    fecha_inicio_plan: "2026-01-01",
    fecha_fin_plan: "2026-02-28",
    children: [conTareas, sinTareas],
  });
  const tasksByItem = groupTasks([task({ id: "t1", work_item_id: "conTareas" })]);

  const ids = (rows: GanttRow[]) => rows.map((r) => r.id);

  it("sin la bandera muestra toda la estructura (cronograma del proyecto)", () => {
    const rows = build({ tree: [raiz], tasksByItem });
    expect(ids(rows)).toContain("sinTareas");
  });

  it("con la bandera poda las ramas sin ninguna tarea del equipo", () => {
    const rows = build({ tree: [raiz], tasksByItem, onlyWithTasks: true });
    expect(ids(rows)).not.toContain("sinTareas");
  });

  it("conserva los ancestros de un nodo con tareas, para no perder el contexto", () => {
    const rows = build({ tree: [raiz], tasksByItem, onlyWithTasks: true });
    expect(ids(rows)).toEqual(["raiz", "conTareas", "t1"]);
  });

  it("si el equipo no tiene ninguna tarea, no queda estructura que mostrar", () => {
    const rows = build({ tree: [raiz], tasksByItem: new Map(), onlyWithTasks: true });
    expect(rows).toEqual([]);
  });
});
