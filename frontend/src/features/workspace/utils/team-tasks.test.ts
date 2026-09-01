import { describe, it, expect } from "vitest";
import {
  activeBlockers,
  buildTaskRows,
  visibleRows,
  daysUntilDue,
  formatDueDate,
  groupTeamTasks,
  isOverdue,
  taskProgressPct,
  urgencyMeta,
  workloadBarClass,
  workloadByMember,
} from "./team-tasks";
import type { ApiTeamTask } from "../api/workspace.api";

const TODAY = "2026-03-10";

function task(over: Partial<ApiTeamTask> = {}): ApiTeamTask {
  return {
    id: "t1",
    title: "Tarea",
    status: "pendiente_por_iniciar",
    priority: "media",
    work_item_id: "wi1",
    work_item_name: "Módulo 1",
    project_id: "p1",
    project_name: "Proyecto",
    assignee_id: null,
    assignee_name: null,
    parent_task_id: null,
    start_date: null,
    due_date: null,
    requires_approval: false,
    progress_pct: 0,
    blocked_by: [],
    depends_on_third_party: false,
    ...over,
  };
}

describe("taskProgressPct", () => {
  it("usa la misma escala que el cronograma", () => {
    expect(taskProgressPct("pendiente_por_iniciar")).toBe(0);
    expect(taskProgressPct("en_progreso")).toBe(35);
    expect(taskProgressPct("en_revision")).toBe(70);
    expect(taskProgressPct("devuelta")).toBe(50);
    expect(taskProgressPct("completada")).toBe(100);
  });
});

describe("urgencyMeta", () => {
  it("traduce la prioridad a lenguaje de urgencia", () => {
    expect(urgencyMeta("urgente").label).toBe("Crítica");
    expect(urgencyMeta("alta").label).toBe("Alta");
  });

  it("degrada a 'Sin definir' ante una prioridad desconocida", () => {
    expect(urgencyMeta("inventada").label).toBe("Sin definir");
  });
});

describe("isOverdue", () => {
  it("marca vencida solo una tarea abierta con fecha pasada", () => {
    expect(isOverdue(task({ status: "en_progreso", due_date: "2026-03-01" }), TODAY)).toBe(true);
    expect(isOverdue(task({ status: "en_progreso", due_date: "2026-03-20" }), TODAY)).toBe(false);
  });

  it("no marca vencida una tarea ya cerrada", () => {
    expect(isOverdue(task({ status: "completada", due_date: "2026-03-01" }), TODAY)).toBe(false);
    expect(isOverdue(task({ status: "cancelada", due_date: "2026-03-01" }), TODAY)).toBe(false);
  });

  it("no marca vencida una tarea aún sin planificar", () => {
    expect(isOverdue(task({ status: "en_progreso", due_date: null }), TODAY)).toBe(false);
  });
});

describe("daysUntilDue", () => {
  it("cuenta hacia adelante y hacia atrás", () => {
    expect(daysUntilDue("2026-03-13", TODAY)).toBe(3);
    expect(daysUntilDue("2026-03-05", TODAY)).toBe(-5);
  });

  it("devuelve null sin fecha", () => {
    expect(daysUntilDue(null, TODAY)).toBeNull();
  });
});

describe("formatDueDate", () => {
  it("no construye Date, así que no desplaza el día por zona horaria", () => {
    expect(formatDueDate("2026-03-01")).toBe("01/03/2026");
  });

  it("dice 'Sin fecha' cuando la tarea no está planificada", () => {
    expect(formatDueDate(null)).toBe("Sin fecha");
  });
});

describe("activeBlockers", () => {
  it("ignora las dependencias ya completadas", () => {
    const t = task({
      blocked_by: [
        { id: "a", title: "Ya hecha", status: "completada" },
        { id: "b", title: "Pendiente", status: "en_progreso" },
      ],
    });
    expect(activeBlockers(t).map((b) => b.id)).toEqual(["b"]);
  });
});

describe("groupTeamTasks", () => {
  const tasks = [
    task({ id: "1", assignee_id: "u1", assignee_name: "Ana", status: "completada" }),
    task({ id: "2", assignee_id: "u1", assignee_name: "Ana", status: "en_progreso" }),
    task({ id: "3", assignee_id: null, status: "en_progreso" }),
  ];

  it("agrupa por integrante y cuenta lo completado", () => {
    const groups = groupTeamTasks(tasks, "integrante");
    expect(groups.map((g) => g.label)).toEqual(["Ana", "Sin responsable"]);
    expect(groups[0].tasks).toHaveLength(2);
    expect(groups[0].doneCount).toBe(1);
  });

  it("agrupa por estado devolviendo siempre las columnas del tablero", () => {
    const groups = groupTeamTasks(tasks, "estado");
    expect(groups.map((g) => g.key)).toEqual([
      "pendiente_por_iniciar",
      "en_progreso",
      "en_revision",
      "devuelta",
      "completada",
    ]);
    // "En progreso" tiene dos; "En revisión" queda vacía a propósito.
    expect(groups[1].tasks).toHaveLength(2);
    expect(groups[2].tasks).toHaveLength(0);
  });

  it("añade la columna 'Cancelada' solo si hay tareas canceladas", () => {
    const withCancelled = [...tasks, task({ id: "4", status: "cancelada" })];
    expect(groupTeamTasks(withCancelled, "estado").map((g) => g.key)).toContain("cancelada");
  });
});

describe("workloadByMember", () => {
  it("cuenta solo tareas abiertas y las mide contra el más cargado", () => {
    const tasks = [
      task({ id: "1", assignee_id: "u1", status: "en_progreso" }),
      task({ id: "2", assignee_id: "u1", status: "en_revision" }),
      task({ id: "3", assignee_id: "u1", status: "completada" }),
      task({ id: "4", assignee_id: "u2", status: "en_progreso" }),
    ];
    const load = workloadByMember(tasks, ["u1", "u2"], TODAY);

    expect(load.u1.openTasks).toBe(2);
    expect(load.u1.pct).toBe(100);
    expect(load.u2.openTasks).toBe(1);
    expect(load.u2.pct).toBe(50);
  });

  it("cuenta las vencidas por separado", () => {
    const load = workloadByMember(
      [task({ assignee_id: "u1", status: "en_progreso", due_date: "2026-01-01" })],
      ["u1"],
      TODAY,
    );
    expect(load.u1.overdueTasks).toBe(1);
  });

  it("ignora tareas de gente que ya no está en el equipo", () => {
    const load = workloadByMember(
      [task({ assignee_id: "fuera", status: "en_progreso" })],
      ["u1"],
      TODAY,
    );
    expect(load.u1.openTasks).toBe(0);
    // Sin nadie con carga, nadie sale al 100%: evita una barra llena falsa.
    expect(load.u1.pct).toBe(0);
  });

  it("no divide por cero cuando el equipo no tiene tareas abiertas", () => {
    const load = workloadByMember([], ["u1", "u2"], TODAY);
    expect(load.u1.pct).toBe(0);
    expect(load.u2.pct).toBe(0);
  });
});

describe("workloadBarClass", () => {
  it("aplica los umbrales verde / ámbar / rojo del diseño", () => {
    expect(workloadBarClass(59)).toContain("emerald");
    expect(workloadBarClass(60)).toContain("amber");
    expect(workloadBarClass(84)).toContain("amber");
    expect(workloadBarClass(85)).toContain("rose");
  });
});

describe("buildTaskRows", () => {
  const padre = task({ id: "p", title: "Guion" });
  const hija1 = task({ id: "h1", title: "Guion parte A", parent_task_id: "p" });
  const hija2 = task({ id: "h2", title: "Guion parte B", parent_task_id: "p" });
  const suelta = task({ id: "s", title: "Banner" });

  it("pone cada subtarea justo debajo de su padre, indentada", () => {
    const rows = buildTaskRows([padre, suelta, hija1, hija2], [padre, hija1, hija2, suelta]);

    expect(rows.map((r) => r.task.id)).toEqual(["p", "h1", "h2", "s"]);
    expect(rows.map((r) => r.depth)).toEqual([0, 1, 1, 0]);
  });

  it("no marca padre desprendido cuando el padre sí está en el grupo", () => {
    const rows = buildTaskRows([padre, hija1], [padre, hija1]);
    expect(rows.every((r) => r.detachedParentTitle === null)).toBe(true);
  });

  it("cuando el padre quedó en otro grupo, la hija sube a raíz con su contexto", () => {
    // Caso real de agrupar por estado: el padre está "en progreso" y la hija
    // "completada", así que caen en columnas distintas.
    const rows = buildTaskRows([hija1], [padre, hija1]);

    expect(rows).toHaveLength(1);
    expect(rows[0].depth).toBe(0);
    expect(rows[0].detachedParentTitle).toBe("Guion");
  });

  it("degrada con gracia si el padre ya no existe", () => {
    const huerfana = task({ id: "x", parent_task_id: "borrada" });
    expect(buildTaskRows([huerfana], [huerfana])[0].detachedParentTitle).toBe("otra tarea");
  });

  it("anida varios niveles", () => {
    const nieta = task({ id: "n", parent_task_id: "h1" });
    const all = [padre, hija1, nieta];
    expect(buildTaskRows(all, all).map((r) => r.depth)).toEqual([0, 1, 2]);
  });

  it("no se cuelga ante un ciclo de padres", () => {
    // Datos corruptos: a → b → a. Debe terminar y no repetir filas.
    const a = task({ id: "a", parent_task_id: "b" });
    const b = task({ id: "b", parent_task_id: "a" });
    const rows = buildTaskRows([a, b], [a, b]);
    expect(rows.length).toBeLessThanOrEqual(2);
  });
});

describe("visibleRows", () => {
  const padre = task({ id: "p" });
  const hija1 = task({ id: "h1", parent_task_id: "p" });
  const nieta = task({ id: "n", parent_task_id: "h1" });
  const otra = task({ id: "o" });
  const all = [padre, hija1, nieta, otra];
  const rows = buildTaskRows(all, all);

  it("sin plegados devuelve todo", () => {
    expect(visibleRows(rows, new Set()).map((r) => r.task.id)).toEqual(["p", "h1", "n", "o"]);
  });

  it("plegar un padre oculta todo su subárbol", () => {
    expect(visibleRows(rows, new Set(["p"])).map((r) => r.task.id)).toEqual(["p", "o"]);
  });

  it("plegar un nivel intermedio solo oculta lo que cuelga de él", () => {
    expect(visibleRows(rows, new Set(["h1"])).map((r) => r.task.id)).toEqual(["p", "h1", "o"]);
  });
});
