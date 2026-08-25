import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type * as workTreeDnd from "../../utils/work-tree-dnd";
import { StructurePanel } from "./StructurePanel";
import { structureApi } from "../../api/structure.api";
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
    shift: vi.fn(),
    clone: vi.fn(),
    addDependency: vi.fn(),
    listDependencies: vi.fn(),
    removeDependency: vi.fn(),
  },
}));

vi.mock("react-router", () => ({ useNavigate: () => vi.fn() }));

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

  it("ofrece recortar el hijo hasta el fin de su padre", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByLabelText(/Resolver conflicto de fechas de Hijo2/i));
    await user.click(await screen.findByRole("button", { name: /Recortar Hijo2/i }));

    await waitFor(() => {
      expect(structureApi.update).toHaveBeenCalledWith("Hijo2", {
        fecha_fin_plan: "2026-01-31",
      });
    });
  });

  it("ofrece extender el padre hasta el fin del hijo", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByLabelText(/Resolver conflicto de fechas de Hijo2/i));
    await user.click(await screen.findByRole("button", { name: /Extender Padre2/i }));

    await waitFor(() => {
      expect(structureApi.update).toHaveBeenCalledWith("Padre2", {
        fecha_fin_plan: "2026-02-20",
      });
    });
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
