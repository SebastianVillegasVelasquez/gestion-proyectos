import { describe, expect, it } from "vitest";
import type { ApiMyTask, ApiWorkItemCrumb } from "../api/personal.api";
import { elementOptionsFrom } from "./element-options";

function crumb(id: string, name: string): ApiWorkItemCrumb {
  return { id, name, tipo_id: `tipo-${id}`, tipo_nombre: "Módulo", es_dependencia_externa: false };
}

function task(ancestors: ApiWorkItemCrumb[]): ApiMyTask {
  return { work_item_ancestors: ancestors } as ApiMyTask;
}

describe("elementOptionsFrom", () => {
  it("ofrece cada elemento una sola vez", () => {
    const curso = crumb("c", "Curso");
    const options = elementOptionsFrom([task([curso]), task([curso])]);

    expect(options).toHaveLength(1);
    expect(options[0].name).toBe("Curso");
  });

  it("cuenta el subárbol: una rama suma las tareas de sus hijos", () => {
    const curso = crumb("c", "Curso");
    const modulo = crumb("m", "Módulo 1");
    const options = elementOptionsFrom([task([curso, modulo]), task([curso])]);

    // El curso aparece en las dos tareas; el módulo solo en una.
    expect(options.find((o) => o.id === "c")?.count).toBe(2);
    expect(options.find((o) => o.id === "m")?.count).toBe(1);
  });

  it("ordena alfabéticamente para que la lista sea buscable a ojo", () => {
    const options = elementOptionsFrom([task([crumb("b", "Zeta"), crumb("a", "Alfa")])]);
    expect(options.map((o) => o.name)).toEqual(["Alfa", "Zeta"]);
  });

  it("ignora las tareas sin elemento (individuales sueltas)", () => {
    expect(elementOptionsFrom([task([])])).toEqual([]);
  });
});
