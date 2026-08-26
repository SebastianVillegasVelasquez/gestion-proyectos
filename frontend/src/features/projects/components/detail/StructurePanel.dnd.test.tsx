import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type * as workTreeDnd from "../../utils/work-tree-dnd";
import { StructurePanel } from "./StructurePanel";
import { structureApi } from "../../api/structure.api";
import { tasksApi } from "../../api/tasks.api";
import type { TipoNodo, WorkItemTree } from "../../types/api.types";

vi.mock("../../api/structure.api", () => ({
  structureApi: {
    listTypes: vi.fn(),
    createType: vi.fn(),
    updateType: vi.fn(),
    deleteType: vi.fn(),
    tree: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    move: vi.fn(),
    trash: vi.fn(),
    restore: vi.fn(),
    shift: vi.fn(),
    clone: vi.fn(),
    addDependency: vi.fn(),
    listDependencies: vi.fn(),
    removeDependency: vi.fn(),
  },
}));

vi.mock("react-router", () => ({ useNavigate: () => vi.fn() }));

vi.mock("../../api/tasks.api", () => ({
  tasksApi: {
    listByProject: vi.fn().mockResolvedValue([]),
    createFromBranch: vi.fn(),
    create: vi.fn(),
  },
}));

// jsdom no calcula layout (getBoundingClientRect devuelve ceros) ni deja fijar
// clientY en un DragEvent, así que la zona de suelta no se puede simular con
// coordenadas. Sustituimos SOLO ese cálculo por una variable del test; el resto
// del módulo (findNode, subtreeIds, computeMovePayload) sigue siendo el real.
let nextDropPos: "before" | "inside" | "after" = "inside";
vi.mock("../../utils/work-tree-dnd", async (importOriginal) => {
  const actual = await importOriginal<typeof workTreeDnd>();
  return { ...actual, dropPosFromEvent: () => nextDropPos };
});

function node(
  id: string,
  children: WorkItemTree[] = [],
  parent_id: string | null,
  over: Partial<WorkItemTree> = {},
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
    ...over,
  };
}

// Padre1 ─ Hijo1 ─ Nieto1
// Padre2 ─ Hijo2
function buildTree(): WorkItemTree[] {
  const nieto1 = node("Nieto1", [], "Hijo1");
  const hijo1 = node("Hijo1", [nieto1], "Padre1");
  const padre1 = node("Padre1", [hijo1], null);
  const hijo2 = node("Hijo2", [], "Padre2");
  const padre2 = node("Padre2", [hijo2], null);
  return [padre1, padre2];
}

const tipos: TipoNodo[] = [
  {
    id: "t1",
    proyecto_id: "p1",
    nombre: "Elemento",
    reglas_anidacion: null,
  } as TipoNodo,
];

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<StructurePanel projectId="p1" />, { wrapper: Wrapper });
}

/** Fila del árbol que contiene el nombre dado (el div con los handlers de DnD). */
function rowFor(name: string): HTMLElement {
  const label = screen.getByText(name);
  const row = label.closest("[draggable]");
  if (!row) {
    throw new Error(`No se encontró la fila arrastrable de ${name}`);
  }
  return row as HTMLElement;
}

/** Simula soltar `fromName` sobre `toName`. `pos` decide en qué tercio de la
 * fila cae el puntero: dentro (centro), antes (arriba) o después (abajo). */
function dragOnto(fromName: string, toName: string, pos: "inside" | "before" | "after") {
  nextDropPos = pos;
  const from = rowFor(fromName);
  const to = rowFor(toName);
  const dataTransfer = { effectAllowed: "", dropEffect: "", setData: vi.fn(), getData: vi.fn() };
  fireEvent.dragStart(from, { dataTransfer });
  fireEvent.dragOver(to, { dataTransfer });
  fireEvent.drop(to, { dataTransfer });
}

describe("StructurePanel · drag & drop de la estructura", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(structureApi.tree).mockResolvedValue(buildTree());
    vi.mocked(structureApi.listTypes).mockResolvedValue(tipos);
    vi.mocked(structureApi.move).mockResolvedValue({} as never);
  });

  it("mueve el hijo de un padre dentro de otro padre", async () => {
    renderPanel();
    await screen.findByText("Hijo1");

    dragOnto("Hijo1", "Padre2", "inside");

    await waitFor(() => {
      expect(structureApi.move).toHaveBeenCalledWith("Hijo1", { new_parent_id: "Padre2" });
    });
  });

  it("mueve un nieto dentro de otro padre", async () => {
    renderPanel();
    await screen.findByText("Nieto1");

    dragOnto("Nieto1", "Padre2", "inside");

    await waitFor(() => {
      expect(structureApi.move).toHaveBeenCalledWith("Nieto1", { new_parent_id: "Padre2" });
    });
  });

  it("mueve un nieto como hermano del hijo de otro padre", async () => {
    renderPanel();
    await screen.findByText("Nieto1");

    dragOnto("Nieto1", "Hijo2", "after");

    await waitFor(() => {
      expect(structureApi.move).toHaveBeenCalledWith("Nieto1", {
        new_parent_id: "Padre2",
        orden: 1,
      });
    });
  });

  it("mueve un nieto dentro del hijo de otro padre (tercer nivel)", async () => {
    renderPanel();
    await screen.findByText("Nieto1");

    dragOnto("Nieto1", "Hijo2", "inside");

    await waitFor(() => {
      expect(structureApi.move).toHaveBeenCalledWith("Nieto1", { new_parent_id: "Hijo2" });
    });
  });

  it("saca un nieto al nivel principal soltándolo sobre un padre", async () => {
    renderPanel();
    await screen.findByText("Nieto1");

    dragOnto("Nieto1", "Padre2", "after");

    await waitFor(() => {
      expect(structureApi.move).toHaveBeenCalledWith("Nieto1", {
        new_parent_id: null,
        orden: 2,
      });
    });
  });

  it("no deja soltar un padre dentro de su propio hijo y avisa", async () => {
    renderPanel();
    await screen.findByText("Hijo1");

    dragOnto("Padre1", "Hijo1", "inside");

    expect(structureApi.move).not.toHaveBeenCalled();
    expect(await screen.findByText(/es parte de su propio contenido/i)).toBeTruthy();
  });

  it("no deja soltar un padre dentro de su nieto y avisa", async () => {
    renderPanel();
    await screen.findByText("Nieto1");

    dragOnto("Padre1", "Nieto1", "inside");

    expect(structureApi.move).not.toHaveBeenCalled();
    expect(await screen.findByText(/es parte de su propio contenido/i)).toBeTruthy();
  });
});

describe("StructurePanel · conflicto de fechas", () => {
  // Padre2 termina el 31/01; Hijo2 se pasa hasta el 20/02 (p. ej. tras moverlo
  // ahí): el movimiento se permitió y el conflicto queda marcado.
  function conflictTree(): WorkItemTree[] {
    const hijo2 = node("Hijo2", [], "Padre2", {
      fecha_inicio_plan: "2026-01-05",
      fecha_fin_plan: "2026-02-20",
      conflicto_fechas: true,
    });
    const padre2 = node("Padre2", [hijo2], null, {
      fecha_inicio_plan: "2026-01-01",
      fecha_fin_plan: "2026-01-31",
    });
    return [padre2];
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(structureApi.tree).mockResolvedValue(conflictTree());
    vi.mocked(structureApi.listTypes).mockResolvedValue(tipos);
    vi.mocked(structureApi.update).mockResolvedValue({} as never);
  });

  it("ofrece recortar el elemento hasta el fin del que lo contiene", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByLabelText(/Resolver conflicto de fechas de Hijo2/i));
    await user.click(
      await screen.findByRole("button", { name: /Que Hijo2 termine el 31\/01\/2026/i }),
    );

    await waitFor(() => {
      expect(structureApi.update).toHaveBeenCalledWith("Hijo2", {
        fecha_fin_plan: "2026-01-31",
      });
    });
  });

  it("ofrece extender el que lo contiene hasta el fin del elemento", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByLabelText(/Resolver conflicto de fechas de Hijo2/i));
    await user.click(
      await screen.findByRole("button", { name: /Que Padre2 termine el 20\/02\/2026/i }),
    );

    await waitFor(() => {
      expect(structureApi.update).toHaveBeenCalledWith("Padre2", {
        fecha_fin_plan: "2026-02-20",
      });
    });
  });

  it("deja poner una fecha a mano en un calendario", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByLabelText(/Resolver conflicto de fechas de Hijo2/i));
    await user.click(await screen.findByRole("button", { name: /Elegir otra fecha/i }));

    // El calendario arranca con la fecha actual del elemento, no con la del
    // que lo contiene: se ajusta lo que está mal, no lo que ya estaba bien.
    const input = screen.getByLabelText(/Fecha de fin de Hijo2/i);
    expect((input as HTMLInputElement).value).toBe("2026-02-20");

    fireEvent.change(input, { target: { value: "2026-01-20" } });
    await user.click(screen.getByRole("button", { name: /Guardar fecha/i }));

    await waitFor(() => {
      expect(structureApi.update).toHaveBeenCalledWith("Hijo2", {
        fecha_fin_plan: "2026-01-20",
      });
    });
  });

  it("avisa si la fecha elegida a mano sigue quedando fuera, sin impedirla", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByLabelText(/Resolver conflicto de fechas de Hijo2/i));
    await user.click(await screen.findByRole("button", { name: /Elegir otra fecha/i }));
    fireEvent.change(screen.getByLabelText(/Fecha de fin de Hijo2/i), {
      target: { value: "2026-03-15" },
    });

    expect(await screen.findByText(/el aviso se mantendrá/i)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Guardar fecha/i }));

    await waitFor(() => {
      expect(structureApi.update).toHaveBeenCalledWith("Hijo2", {
        fecha_fin_plan: "2026-03-15",
      });
    });
  });

  it("no menciona la palabra «padre» en el modal", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByLabelText(/Resolver conflicto de fechas de Hijo2/i));
    const modal = await screen.findByRole("dialog");

    // «Padre2» es el NOMBRE de un elemento y sí debe salir; lo que no debe
    // aparecer es la palabra suelta, hablándole a quien planifica de "padres".
    expect(modal.textContent).not.toMatch(/\bpadre\b/i);
    expect(modal.textContent).toContain("Padre2");
  });

  it("permite dejar el conflicto sin resolver", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByLabelText(/Resolver conflicto de fechas de Hijo2/i));
    await user.click(await screen.findByRole("button", { name: /Dejarlo así por ahora/i }));

    expect(structureApi.update).not.toHaveBeenCalled();
  });

  it("no marca conflicto cuando el hijo cabe en su padre", async () => {
    vi.mocked(structureApi.tree).mockResolvedValue([
      node("Padre2", [node("Hijo2", [], "Padre2")], null),
    ]);
    renderPanel();

    await screen.findByText("Hijo2");
    expect(screen.queryByLabelText(/Resolver conflicto de fechas/i)).toBeNull();
  });
});

describe("StructurePanel · sacar un elemento un nivel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(structureApi.tree).mockResolvedValue(buildTree());
    vi.mocked(structureApi.listTypes).mockResolvedValue(tipos);
    vi.mocked(structureApi.move).mockResolvedValue({} as never);
  });

  /** Abre el menú de opciones de la fila que contiene `name`. */
  async function openRowMenu(user: ReturnType<typeof userEvent.setup>, name: string) {
    const row = rowFor(name);
    const menuButton = within(row).getByLabelText("Opciones del elemento");
    await user.click(menuButton);
  }

  it("saca un nieto para dejarlo junto a lo que lo contenía", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("Nieto1");

    await openRowMenu(user, "Nieto1");
    await user.click(await screen.findByRole("menuitem", { name: /Sacar un nivel/i }));

    // Nieto1 estaba en Hijo1 (dentro de Padre1): sale a Padre1, detrás de Hijo1.
    await waitFor(() => {
      expect(structureApi.move).toHaveBeenCalledWith("Nieto1", {
        new_parent_id: "Padre1",
        orden: 1,
      });
    });
  });

  it("saca un hijo hasta el nivel principal", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("Hijo1");

    await openRowMenu(user, "Hijo1");
    await user.click(await screen.findByRole("menuitem", { name: /Sacar un nivel/i }));

    await waitFor(() => {
      expect(structureApi.move).toHaveBeenCalledWith("Hijo1", {
        new_parent_id: null,
        orden: 1,
      });
    });
  });

  it("no ofrece la opción en el nivel principal", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("Padre1");

    await openRowMenu(user, "Padre1");

    expect(await screen.findByRole("menu")).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: /Sacar un nivel/i })).toBeNull();
  });
});

describe("StructurePanel · papelera", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(structureApi.tree).mockResolvedValue(buildTree());
    vi.mocked(structureApi.listTypes).mockResolvedValue(tipos);
    vi.mocked(structureApi.restore).mockResolvedValue({} as never);
    vi.mocked(structureApi.trash).mockResolvedValue([
      {
        id: "Borrado1",
        nombre: "Unidad 4",
        tipo_nombre: "Unidad",
        deleted_at: new Date().toISOString(),
        contenido: 12,
      },
    ]);
  });

  it("no consulta la papelera hasta que se abre", async () => {
    renderPanel();
    await screen.findByText("Padre1");

    expect(structureApi.trash).not.toHaveBeenCalled();
  });

  it("lista lo borrado con lo que contiene y lo restaura", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("Padre1");

    await user.click(screen.getByRole("button", { name: /Papelera/i }));

    expect(await screen.findByText("Unidad 4")).toBeTruthy();
    // La cuenta de lo que volvería con él es lo que decide si merece la pena.
    expect(screen.getByText(/contiene 12 elementos/i)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Restaurar/i }));

    await waitFor(() => {
      expect(structureApi.restore).toHaveBeenCalledWith("Borrado1");
    });
  });

  it("avisa cuando no hay nada borrado", async () => {
    vi.mocked(structureApi.trash).mockResolvedValue([]);
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("Padre1");

    await user.click(screen.getByRole("button", { name: /Papelera/i }));

    expect(await screen.findByText(/No has borrado nada/i)).toBeTruthy();
  });
});

describe("StructurePanel · tareas de toda la rama", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(structureApi.tree).mockResolvedValue(buildTree());
    vi.mocked(structureApi.listTypes).mockResolvedValue(tipos);
    vi.mocked(tasksApi.createFromBranch).mockResolvedValue({
      created: [{ id: "t1" }, { id: "t2" }] as never,
      skipped: [{ work_item_id: "Nieto1", nombre: "Nieto1", motivo: "Ya tiene una tarea" }],
      total_elementos: 3,
    });
  });

  async function openBulk(user: ReturnType<typeof userEvent.setup>, name: string) {
    const row = rowFor(name);
    await user.click(within(row).getByLabelText("Opciones del elemento"));
    await user.click(
      await screen.findByRole("menuitem", { name: /Crear tareas de toda la rama/i }),
    );
  }

  it("no ofrece la carga en bloque sobre un elemento sin contenido", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("Nieto1");

    const row = rowFor("Nieto1");
    await user.click(within(row).getByLabelText("Opciones del elemento"));

    expect(screen.queryByRole("menuitem", { name: /toda la rama/i })).toBeNull();
  });

  it("anticipa cuántas tareas saldrán y las crea", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("Padre1");

    await openBulk(user, "Padre1");
    // Padre1 ─ Hijo1 ─ Nieto1: solo "Nieto1" es hoja, así que sale 1 tarea.
    await user.click(await screen.findByRole("button", { name: /Crear 1 tareas/i }));

    await waitFor(() => {
      expect(tasksApi.createFromBranch).toHaveBeenCalledWith(
        "Padre1",
        expect.objectContaining({ only_leaves: true, skip_with_tasks: true }),
      );
    });
  });

  it("incluye los agrupadores al desmarcar «solo los que no contienen nada»", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("Padre1");

    await openBulk(user, "Padre1");
    await user.click(screen.getByRole("checkbox", { name: /no contienen nada/i }));

    // Ahora entran los tres elementos de la rama.
    expect(await screen.findByRole("button", { name: /Crear 3 tareas/i })).toBeTruthy();
  });

  it("resume lo creado y lo que se saltó", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("Padre1");

    await openBulk(user, "Padre1");
    await user.click(await screen.findByRole("button", { name: /Crear 1 tareas/i }));

    expect(await screen.findByText(/2 tareas creadas/i)).toBeTruthy();
    expect(screen.getByText(/Ya tiene una tarea/i)).toBeTruthy();
  });
});
