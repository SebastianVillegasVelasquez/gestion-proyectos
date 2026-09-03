import { describe, expect, it } from "vitest";
import type { ApiMyTask, ApiWorkItemCrumb } from "../api/personal.api";
import { elementOptionsFrom, taskMatchesElement } from "./element-options";

function crumb(id: string, name: string, tipoId = `tipo-${id}`): ApiWorkItemCrumb {
  return { id, name, tipo_id: tipoId, tipo_nombre: "Módulo", es_dependencia_externa: false };
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

  it("agrupa los homónimos: un mismo nombre es UNA entrada, no veinte", () => {
    // «Aprobación CTS» se repite bajo cada curso: son elementos distintos con
    // el mismo nombre y tipo, y en la lista son indistinguibles.
    const a = crumb("a", "Aprobación CTS", "tipo-terceros");
    const b = crumb("b", "Aprobación CTS", "tipo-terceros");
    const options = elementOptionsFrom([task([a]), task([b])]);

    expect(options).toHaveLength(1);
    expect(options[0].count).toBe(2);
    expect(options[0].ids).toEqual(new Set(["a", "b"]));
  });

  it("no agrupa dos nombres iguales de tipos distintos", () => {
    const options = elementOptionsFrom([
      task([crumb("a", "Introducción", "tipo-unidad")]),
      task([crumb("b", "Introducción", "tipo-curso")]),
    ]);
    expect(options).toHaveLength(2);
  });

  it("cuenta el subárbol: una rama suma las tareas de sus hijos", () => {
    const curso = crumb("c", "Curso");
    const modulo = crumb("m", "Módulo 1");
    const options = elementOptionsFrom([task([curso, modulo]), task([curso])]);

    // El curso aparece en las dos tareas; el módulo solo en una.
    expect(options.find((o) => o.name === "Curso")?.count).toBe(2);
    expect(options.find((o) => o.name === "Módulo 1")?.count).toBe(1);
  });

  it("ordena alfabéticamente para que la lista sea buscable a ojo", () => {
    const options = elementOptionsFrom([task([crumb("b", "Zeta"), crumb("a", "Alfa")])]);
    expect(options.map((o) => o.name)).toEqual(["Alfa", "Zeta"]);
  });

  it("ignora las tareas sin elemento (individuales sueltas)", () => {
    expect(elementOptionsFrom([task([])])).toEqual([]);
  });
});

describe("taskMatchesElement", () => {
  it("filtrar por un nombre agrupado trae las tareas de todos sus homónimos", () => {
    const a = crumb("a", "Aprobación CTS", "tipo-terceros");
    const b = crumb("b", "Aprobación CTS", "tipo-terceros");
    const otra = task([crumb("z", "Otra cosa")]);
    const [option] = elementOptionsFrom([task([a]), task([b])]);

    expect(taskMatchesElement(task([a]), option)).toBe(true);
    expect(taskMatchesElement(task([b]), option)).toBe(true);
    expect(taskMatchesElement(otra, option)).toBe(false);
  });
});
