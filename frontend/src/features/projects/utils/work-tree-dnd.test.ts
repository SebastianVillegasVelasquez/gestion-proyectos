import { describe, it, expect } from "vitest";
import {
  collapsibleIdsBelowRoot,
  findNode,
  subtreeIds,
  computeMovePayload,
  computeOutdentPayload,
  resolveDrop,
} from "./work-tree-dnd";
import type { WorkItemTree } from "../types/api.types";

function node(
  id: string,
  children: WorkItemTree[] = [],
  parent_id: string | null = null,
): WorkItemTree {
  return {
    id,
    proyecto_id: "p1",
    parent_id,
    tipo_id: "t1",
    nombre: id,
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
    children,
  };
}

// Árbol:
// A
//  ├─ B
//  └─ C
// D
function buildTree(): WorkItemTree[] {
  const b = node("B", [], "A");
  const c = node("C", [], "A");
  const a = node("A", [b, c], null);
  const d = node("D", [], null);
  return [a, d];
}

describe("findNode", () => {
  it("finds a nested node by id", () => {
    const tree = buildTree();
    expect(findNode(tree, "B")?.id).toBe("B");
    expect(findNode(tree, "D")?.id).toBe("D");
  });

  it("returns null when the id is not in the tree", () => {
    expect(findNode(buildTree(), "nope")).toBeNull();
  });
});

describe("subtreeIds", () => {
  it("collects a node and all of its descendants", () => {
    const tree = buildTree();
    const a = findNode(tree, "A")!;
    const ids = subtreeIds(a);
    expect(ids).toEqual(new Set(["A", "B", "C"]));
  });

  it("returns just the node id for a leaf", () => {
    const tree = buildTree();
    const d = findNode(tree, "D")!;
    expect(subtreeIds(d)).toEqual(new Set(["D"]));
  });
});

describe("computeMovePayload", () => {
  it("reparents inside the target node", () => {
    const tree = buildTree();
    const payload = computeMovePayload(tree, "D", "A", "inside");
    expect(payload).toEqual({ new_parent_id: "A" });
  });

  it("moves a child of one parent into another parent's children (before)", () => {
    const tree = buildTree();
    // Mover D antes de B (hijo de A): D pasa a ser hijo de A, en el índice de B.
    const payload = computeMovePayload(tree, "D", "B", "before");
    expect(payload).toEqual({ new_parent_id: "A", orden: 0 });
  });

  it("moves a nested child to become a sibling after another nested child", () => {
    const tree = buildTree();
    // Mover B después de C: sigue siendo hijo de A, pero al final.
    const payload = computeMovePayload(tree, "B", "C", "after");
    expect(payload).toEqual({ new_parent_id: "A", orden: 1 });
  });

  it("moves a child out to the root level, placed after a root sibling", () => {
    const tree = buildTree();
    // Mover B (hijo de A) después de D (raíz): B pasa a ser raíz, al final
    // (la raíz es [A, D]; tras D va el índice 2).
    const payload = computeMovePayload(tree, "B", "D", "after");
    expect(payload).toEqual({ new_parent_id: null, orden: 2 });
  });

  it("returns null when the target does not exist", () => {
    const tree = buildTree();
    expect(computeMovePayload(tree, "B", "missing", "inside")).toBeNull();
  });
});

describe("resolveDrop", () => {
  // Árbol más profundo para los casos de anidación:
  // A ─ B ─ B1
  // D
  function deepTree(): WorkItemTree[] {
    const b1 = node("B1", [], "B");
    const b = node("B", [b1], "A");
    const a = node("A", [b], null);
    const d = node("D", [], null);
    return [a, d];
  }

  it("permite mover un hijo dentro de otro padre", () => {
    expect(resolveDrop(deepTree(), "B", "D", "inside")).toEqual({
      ok: true,
      payload: { new_parent_id: "D" },
    });
  });

  it("permite mover un nieto dentro de otro padre", () => {
    expect(resolveDrop(deepTree(), "B1", "D", "inside")).toEqual({
      ok: true,
      payload: { new_parent_id: "D" },
    });
  });

  it("permite mover un nieto al nivel principal como hermano", () => {
    expect(resolveDrop(deepTree(), "B1", "D", "after")).toEqual({
      ok: true,
      payload: { new_parent_id: null, orden: 2 },
    });
  });

  it("rechaza mover un elemento dentro de su propio hijo", () => {
    const decision = resolveDrop(deepTree(), "A", "B", "inside");
    expect(decision).toMatchObject({ ok: false });
    expect(decision && !decision.ok && decision.reason).toMatch(/su propio contenido/i);
  });

  it("rechaza mover un elemento dentro de su nieto", () => {
    expect(resolveDrop(deepTree(), "A", "B1", "inside")).toMatchObject({ ok: false });
  });

  it("rechaza colocarse como hermano de un descendiente propio", () => {
    // Soltar A "antes de B1" lo dejaría como hijo de B, que es descendiente
    // suyo: el mismo ciclo, por la puerta de atrás.
    expect(resolveDrop(deepTree(), "A", "B1", "before")).toMatchObject({ ok: false });
  });

  it("ignora soltar un elemento sobre sí mismo", () => {
    expect(resolveDrop(deepTree(), "B", "B", "inside")).toBeNull();
  });

  it("devuelve null si el destino ya no existe", () => {
    expect(resolveDrop(deepTree(), "B", "missing", "inside")).toBeNull();
  });
});

describe("computeOutdentPayload", () => {
  // A ─ B ─ B1
  // D
  function deepTree(): WorkItemTree[] {
    const b1 = node("B1", [], "B");
    const b = node("B", [b1], "A");
    const a = node("A", [b], null);
    const d = node("D", [], null);
    return [a, d];
  }

  it("saca un nieto para dejarlo junto a quien lo contenía", () => {
    // B1 sale de B y pasa a ser hijo de A, justo detrás de B.
    expect(computeOutdentPayload(deepTree(), "B1")).toEqual({
      new_parent_id: "A",
      orden: 1,
    });
  });

  it("saca un hijo de primer nivel al nivel principal, tras su contenedor", () => {
    // B sale de A: nivel principal, detrás de A (que ocupa el índice 0).
    expect(computeOutdentPayload(deepTree(), "B")).toEqual({
      new_parent_id: null,
      orden: 1,
    });
  });

  it("no hace nada con un elemento que ya está en el nivel principal", () => {
    expect(computeOutdentPayload(deepTree(), "A")).toBeNull();
    expect(computeOutdentPayload(deepTree(), "D")).toBeNull();
  });

  it("devuelve null si el elemento no existe", () => {
    expect(computeOutdentPayload(deepTree(), "missing")).toBeNull();
  });
});

describe("collapsibleIdsBelowRoot", () => {
  // Raíz ─ 3 padres, cada uno con 3 hijos.
  function proyecto(): WorkItemTree[] {
    const padres = ["A", "B", "C"].map((p) =>
      node(
        p,
        ["1", "2", "3"].map((h) => node(`${p}${h}`, [], p)),
        "Raiz",
      ),
    );
    return [node("Raiz", padres, null)];
  }

  it("deja la raíz abierta y pliega a sus hijos", () => {
    // Se ve la raíz y sus 3 padres; el detalle de dentro queda plegado.
    expect(collapsibleIdsBelowRoot(proyecto()).sort()).toEqual(["A", "B", "C"]);
  });

  it("no incluye la raíz: plegarla escondería el proyecto entero", () => {
    expect(collapsibleIdsBelowRoot(proyecto())).not.toContain("Raiz");
  });

  it("pliega también los niveles más profundos", () => {
    const nieto = node("A1a", [node("A1a1", [], "A1a")], "A1");
    const hijo = node("A1", [nieto], "A");
    const padre = node("A", [hijo], "Raiz");
    const ids = collapsibleIdsBelowRoot([node("Raiz", [padre], null)]);
    expect(ids.sort()).toEqual(["A", "A1", "A1a"]);
  });

  it("con varias raíces, todas quedan abiertas", () => {
    const tree = [
      node("R1", [node("R1a", [node("R1a1", [], "R1a")], "R1")], null),
      node("R2", [node("R2a", [], "R2")], null),
    ];
    // R1 y R2 abiertas; se pliega R1a (que tiene contenido). R2a es hoja.
    expect(collapsibleIdsBelowRoot(tree)).toEqual(["R1a"]);
  });

  it("no devuelve nada cuando no hay nada que plegar", () => {
    expect(collapsibleIdsBelowRoot([node("Solo", [], null)])).toEqual([]);
    expect(collapsibleIdsBelowRoot([])).toEqual([]);
  });
});
