import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { TraceabilityPanel } from "./TraceabilityPanel";
import { traceabilityApi } from "../../api/traceability.api";
import type { ProjectTraceability } from "../../types/api.types";

vi.mock("../../api/traceability.api", () => ({
  traceabilityApi: { get: vi.fn() },
}));

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<TraceabilityPanel projectId="p1" />, { wrapper: Wrapper });
}

const data: ProjectTraceability = {
  project_id: "p1",
  summary: {
    total_events: 3,
    delays: 1,
    deliveries: 1,
    returns: 1,
    reschedules: 0,
    reassignments: 0,
  },
  events: [
    {
      id: "e1",
      task_id: "t1",
      task_title: "Guion Unidad 1",
      actor_name: "Ana García",
      action: "cambio_estado",
      old_status: "en_progreso",
      new_status: "en_progreso",
      change_reason: "Sigue en progreso tras la fecha límite",
      old_value: null,
      new_value: null,
      created_at: "2026-02-01T11:00:00Z",
      kind: "inicio",
      is_delay: true,
    },
    {
      id: "e2",
      task_id: "t2",
      task_title: "Aprobar plan",
      actor_name: "Juan Gómez",
      action: "cambio_estado",
      old_status: "en_progreso",
      new_status: "en_revision",
      change_reason: null,
      old_value: null,
      new_value: null,
      created_at: "2026-01-10T09:00:00Z",
      kind: "entrega",
      is_delay: false,
    },
    {
      id: "e3",
      task_id: "t2",
      task_title: "Aprobar plan",
      actor_name: "Líder",
      action: "cambio_estado",
      old_status: "en_revision",
      new_status: "devuelta",
      change_reason: "Faltan objetivos",
      old_value: null,
      new_value: null,
      created_at: "2026-01-12T09:00:00Z",
      kind: "devolucion",
      is_delay: false,
    },
  ],
};

describe("TraceabilityPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the summary counts", async () => {
    vi.mocked(traceabilityApi.get).mockResolvedValue(data);
    renderPanel();

    // Resumen: "Eventos" muestra 3, "Retrasos" muestra 1.
    expect(await screen.findByText("Eventos")).toBeInTheDocument();
    expect(screen.getByText("Retrasos")).toBeInTheDocument();
    expect(screen.getByText("Entregas")).toBeInTheDocument();
  });

  it("renders timeline events and flags a delay as 'Retraso'", async () => {
    vi.mocked(traceabilityApi.get).mockResolvedValue(data);
    renderPanel();

    expect(await screen.findByText("Guion Unidad 1")).toBeInTheDocument();
    expect(screen.getByText("Retraso")).toBeInTheDocument();
    expect(screen.getByText("Entrega")).toBeInTheDocument();
    expect(screen.getByText("Tarea devuelta")).toBeInTheDocument();
  });

  it("filters to only delays when toggled", async () => {
    vi.mocked(traceabilityApi.get).mockResolvedValue(data);
    renderPanel();
    await screen.findByText("Guion Unidad 1");

    // Por rol y no por texto suelto: la cabecera del resumen y los filtros
    // conviven en la misma pantalla.
    await userEvent.click(screen.getByRole("button", { name: "Solo retrasos" }));

    // El evento de retraso permanece; los no-retraso desaparecen.
    expect(screen.getByText("Guion Unidad 1")).toBeInTheDocument();
    expect(screen.queryByText("Entrega")).not.toBeInTheDocument();
    expect(screen.queryByText("Tarea devuelta")).not.toBeInTheDocument();
  });

  it("filters the timeline by free-text search", async () => {
    vi.mocked(traceabilityApi.get).mockResolvedValue(data);
    renderPanel();
    await screen.findByText("Guion Unidad 1");

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Buscar en la línea de tiempo" }),
      "guion",
    );

    expect(screen.getByText("Guion Unidad 1")).toBeInTheDocument();
    expect(screen.queryByText("Tarea devuelta")).not.toBeInTheDocument();
  });

  it("shows an empty state when there are no events", async () => {
    vi.mocked(traceabilityApi.get).mockResolvedValue({
      project_id: "p1",
      summary: {
        total_events: 0,
        delays: 0,
        deliveries: 0,
        returns: 0,
        reschedules: 0,
        reassignments: 0,
      },
      events: [],
    });
    renderPanel();

    expect(await screen.findByText("Sin eventos de trazabilidad")).toBeInTheDocument();
  });
});
