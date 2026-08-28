import { describe, it, expect } from "vitest";
import { buildTeamBoard } from "./team-board";
import type { Task } from "../types/api.types";

const TODAY = "2026-06-15";

function task(over: Partial<Pick<Task, "id" | "status" | "due_date">> = {}): Task {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    status: over.status ?? "en_progreso",
    due_date: over.due_date ?? null,
  } as Task;
}

const cols = (tasks: Task[]) =>
  Object.fromEntries(buildTeamBoard(tasks, TODAY).map((c) => [c.key, c.tasks]));

describe("buildTeamBoard", () => {
  it("siempre devuelve la lane de riesgo primero y las 5 columnas de estado", () => {
    const keys = buildTeamBoard([], TODAY).map((c) => c.key);
    expect(keys).toEqual([
      "en_riesgo",
      "pendiente_por_iniciar",
      "en_progreso",
      "en_revision",
      "devuelta",
      "completada",
    ]);
    expect(buildTeamBoard([], TODAY)[0].atRisk).toBe(true);
  });

  it("saca las tareas abiertas vencidas o por vencer de su columna de estado", () => {
    const vencida = task({ id: "a", status: "en_progreso", due_date: "2026-06-01" });
    const porVencer = task({ id: "b", status: "pendiente_por_iniciar", due_date: "2026-06-16" });
    const holgada = task({ id: "c", status: "en_progreso", due_date: "2026-07-30" });

    const c = cols([vencida, porVencer, holgada]);
    expect(c.en_riesgo.map((t) => t.id).sort()).toEqual(["a", "b"]);
    expect(c.en_progreso.map((t) => t.id)).toEqual(["c"]);
    expect(c.pendiente_por_iniciar).toEqual([]);
  });

  it("una tarea completada o cancelada nunca entra en riesgo aunque esté vencida", () => {
    const c = cols([
      task({ id: "d", status: "completada", due_date: "2026-01-01" }),
      task({ id: "e", status: "cancelada", due_date: "2026-01-01" }),
    ]);
    expect(c.en_riesgo).toEqual([]);
    expect(c.completada.map((t) => t.id)).toEqual(["d"]);
    expect(c.cancelada.map((t) => t.id)).toEqual(["e"]);
  });

  it("omite la columna Cancelada cuando no hay ninguna", () => {
    expect(buildTeamBoard([task()], TODAY).some((col) => col.key === "cancelada")).toBe(false);
  });
});
