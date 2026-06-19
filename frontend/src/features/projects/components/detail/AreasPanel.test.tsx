import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { AreasPanel } from "./AreasPanel";
import { areasApi } from "../../api/areas.api";
import type { ProjectAreas } from "../../types/api.types";

vi.mock("../../api/areas.api", () => ({
  areasApi: { get: vi.fn() },
}));

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<AreasPanel projectId="p1" />, { wrapper: Wrapper });
}

const data: ProjectAreas = {
  project_id: "p1",
  total_assigned: 14,
  total_completed: 6,
  areas: [
    {
      position: "desarrollador",
      member_count: 3,
      assigned_tasks: 10,
      completed_tasks: 5,
      completion_pct: 50,
    },
    {
      position: "diseñador_grafico",
      member_count: 2,
      assigned_tasks: 4,
      completed_tasks: 1,
      completion_pct: 25,
    },
  ],
};

describe("AreasPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders each area with its readable label and percentage", async () => {
    vi.mocked(areasApi.get).mockResolvedValue(data);
    renderPanel();

    expect(await screen.findByText("Desarrollador")).toBeInTheDocument();
    expect(screen.getByText("Diseñador gráfico")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("5/10 tareas")).toBeInTheDocument();
  });

  it("shows the overall completed total", async () => {
    vi.mocked(areasApi.get).mockResolvedValue(data);
    renderPanel();

    expect(await screen.findByText("6/14 tareas completadas en total")).toBeInTheDocument();
  });

  it("shows an empty state when no tasks are assigned", async () => {
    vi.mocked(areasApi.get).mockResolvedValue({
      project_id: "p1",
      total_assigned: 0,
      total_completed: 0,
      areas: [],
    });
    renderPanel();

    expect(await screen.findByText("Aún no hay tareas asignadas")).toBeInTheDocument();
  });

  it("shows an error state with retry when the request fails", async () => {
    vi.mocked(areasApi.get).mockRejectedValue(new Error("500"));
    renderPanel();

    expect(await screen.findByText("No se pudo cargar el avance por equipo")).toBeInTheDocument();
  });
});
