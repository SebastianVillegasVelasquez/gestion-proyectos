import { describe, it, expect } from "vitest";
import { groupMyTasksByProject } from "./group-my-tasks";
import type { DashboardTaskItem } from "../types";

const TODAY = "2026-08-26";

function task(over: Partial<DashboardTaskItem> & { id: string }): DashboardTaskItem {
  return {
    title: over.id,
    status: "pendiente_por_iniciar",
    project_name: "Proyecto A",
    project_id: "p1",
    due_date: "2026-09-01",
    ...over,
  };
}

describe("groupMyTasksByProject", () => {
  it("agrupa las tareas por proyecto", () => {
    const groups = groupMyTasksByProject(
      [
        task({ id: "a1" }),
        task({ id: "b1", project_id: "p2", project_name: "Proyecto B" }),
        task({ id: "a2" }),
      ],
      TODAY,
    );

    expect(groups).toHaveLength(2);
    const a = groups.find((g) => g.projectId === "p1");
    expect(a?.tasks.map((t) => t.id)).toEqual(["a1", "a2"]);
  });

  it("deja fuera las tareas ya cerradas", () => {
    const groups = groupMyTasksByProject(
      [
        task({ id: "hecha", status: "completada" }),
        task({ id: "cancelada", status: "cancelada" }),
        task({ id: "viva" }),
      ],
      TODAY,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["viva"]);
  });

  it("cuenta las vencidas y pone esos proyectos primero", () => {
    const groups = groupMyTasksByProject(
      [
        // Proyecto A: tres tareas, ninguna vencida.
        task({ id: "a1" }),
        task({ id: "a2" }),
        task({ id: "a3" }),
        // Proyecto B: una sola, pero vencida → va antes pese a tener menos.
        task({
          id: "b1",
          project_id: "p2",
          project_name: "Proyecto B",
          due_date: "2026-08-01",
        }),
      ],
      TODAY,
    );

    expect(groups[0].projectId).toBe("p2");
    expect(groups[0].overdue).toBe(1);
    expect(groups[1].overdue).toBe(0);
  });

  it("ordena las tareas de cada proyecto por fecha de fin", () => {
    const groups = groupMyTasksByProject(
      [
        task({ id: "tarde", due_date: "2026-12-01" }),
        task({ id: "pronto", due_date: "2026-08-28" }),
      ],
      TODAY,
    );

    expect(groups[0].tasks.map((t) => t.id)).toEqual(["pronto", "tarde"]);
  });

  it("junta en un solo grupo las tareas sin proyecto", () => {
    const groups = groupMyTasksByProject(
      [
        task({ id: "x", project_id: null, project_name: null }),
        task({ id: "y", project_id: null, project_name: null }),
      ],
      TODAY,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].projectName).toBe("Sin proyecto");
    expect(groups[0].tasks).toHaveLength(2);
  });

  it("no devuelve grupos cuando no hay nada pendiente", () => {
    expect(groupMyTasksByProject([], TODAY)).toEqual([]);
  });

  it("incluye las tareas sin fecha límite: no son vencidas y van al final", () => {
    const groups = groupMyTasksByProject(
      [
        task({ id: "sin-fecha", due_date: null }),
        task({ id: "con-fecha", due_date: "2026-08-28" }),
        task({ id: "vencida", due_date: "2026-08-01" }),
      ],
      TODAY,
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].overdue).toBe(1); // solo "vencida", no la de fecha nula
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["vencida", "con-fecha", "sin-fecha"]);
  });
});
