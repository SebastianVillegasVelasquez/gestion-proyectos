import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ProjectReportPage } from "./ProjectReportPage";
import { analyticsApi, type ProjectAnalytics } from "../api/analytics.api";

vi.mock("../api/analytics.api", () => ({
  analyticsApi: { get: vi.fn(), downloadHtml: vi.fn() },
}));

vi.mock("react-router", () => ({
  useParams: () => ({ projectId: "p1" }),
  useNavigate: () => vi.fn(),
}));

// Los selectores de filtro consultan al backend; los neutralizamos.
vi.mock("@/features/projects/hooks/use-teams", () => ({
  useTeams: () => ({ data: { items: [] } }),
}));
vi.mock("@/features/projects/hooks/use-members", () => ({
  useProjectMembers: () => ({ data: [] }),
}));
vi.mock("@/features/projects/hooks/use-structure", () => ({
  useWorkTree: () => ({ data: [] }),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<ProjectReportPage />, { wrapper: Wrapper });
}

function analytics(over: Partial<ProjectAnalytics> = {}): ProjectAnalytics {
  return {
    project_id: "p1",
    project_name: "Diplomado IA",
    generated_at: "2026-08-28T12:00:00Z",
    filters: {},
    overview: {
      total_tasks: 10,
      by_status: { completada: 4, en_progreso: 6 },
      progress_pct: 40,
      overdue_open: 2,
      at_risk_open: 1,
      avg_schedule_slip_bdays: 1.5,
      cycle_time_p50_bdays: 8,
      cycle_time_p90_bdays: 14,
      rework_rate_pct: 25,
      throughput_last_weeks: [
        { week_start: "2026-08-17", count: 2 },
        { week_start: "2026-08-24", count: 3 },
      ],
    },
    burnup: {
      window_start: "2026-08-01",
      window_end: "2026-09-30",
      total_scope: 10,
      points: [
        { date: "2026-08-03", ideal: 0, actual: 0 },
        { date: "2026-08-24", ideal: 5, actual: 4 },
      ],
    },
    plan: {
      window_start: "2026-08-01",
      window_end: "2026-09-30",
      today: "2026-08-28",
      day_index: 27,
      total_days: 60,
      expected_tasks: 7,
      expected_pct: 70,
      completed_tasks: 4,
      completed_pct: 40,
      gap_pts: 30,
      status: "at_risk",
    },
    health: { total: 10, completed: 4, on_track: 3, at_risk: 1, overdue: 2 },
    components: [
      {
        id: "e1",
        parent_id: null,
        name: "Unidad 1",
        tipo_id: "tp1",
        tipo_nombre: "Unidad",
        depth: 0,
        path: ["Unidad 1"],
        child_count: 1,
        direct_tasks: 1,
        total: 5,
        completed: 2,
        started: 2,
        not_started: 1,
        overdue: 1,
        at_risk: 0,
        completed_pct: 40,
        started_pct: 40,
        progress_pct: 55,
        started_progress_pct: 60,
        state: "atrasada",
      },
      {
        id: "e2",
        parent_id: "e1",
        name: "Clase A",
        tipo_id: "tp2",
        tipo_nombre: "Clase",
        depth: 1,
        path: ["Unidad 1", "Clase A"],
        child_count: 0,
        direct_tasks: 4,
        total: 4,
        completed: 4,
        started: 0,
        not_started: 0,
        overdue: 0,
        at_risk: 0,
        completed_pct: 100,
        started_pct: 0,
        progress_pct: 100,
        started_progress_pct: 0,
        state: "completada",
      },
    ],
    by_team: [
      {
        team_id: "t1",
        team_name: "Producción",
        assigned: 6,
        completed: 3,
        open: 3,
        overdue: 1,
        cycle_time_bdays: 7,
        review_time_bdays: 2,
        rework_rate_pct: 33,
        open_per_member: [{ user_id: "u1", name: "Ana García", open_count: 2 }],
      },
    ],
    by_person: [
      {
        user_id: "u1",
        name: "Ana García",
        completed: 3,
        open_count: 2,
        cycle_time_bdays: 6,
        on_time_pct: 80,
        returns_received: 1,
        logged_days: 12,
      },
    ],
    delivery_lapses: [
      {
        task_id: "k1",
        task_title: "Grabar video",
        element_path: ["Unidad 1"],
        versions: 2,
        production_bdays: 5,
        review_bdays: 3,
        total_bdays: 8,
      },
    ],
    tasks: [
      {
        task_id: "k1",
        title: "Grabar video",
        element_path: ["Unidad 1"],
        responsable: "Ana García",
        equipo: "Producción",
        estado: "completada",
        prioridad: "media",
        start_date: "2026-08-10",
        due_date: "2026-08-20",
        completed_date: "2026-08-25",
        slip_bdays: 3,
        returns: 1,
        versions: 2,
        progress_pct: 100,
      },
    ],
    ...over,
  };
}

describe("ProjectReportPage (analítica)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(analyticsApi.get).mockResolvedValue(analytics());
  });

  it("muestra las métricas generales", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: /Diplomado IA/ })).toBeTruthy();
    expect(screen.getAllByText("40%").length).toBeGreaterThan(0); // avance
    expect(screen.getByText("Retrabajo")).toBeTruthy();
    // El rediseño: avance frente al plan, salud y distribución por estado.
    expect(screen.getByText("Avance frente al plan")).toBeTruthy();
    expect(screen.getByText(/En riesgo · 30 pts bajo el plan/)).toBeTruthy();
    expect(screen.getByText("Salud de las 10 tareas")).toBeTruthy();
    expect(screen.getByText("Distribución por estado")).toBeTruthy();
  });

  it("cambia de pestaña a Equipos y muestra su tabla", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Avance frente al plan");
    await user.click(screen.getByRole("tab", { name: "Equipos" }));
    expect(screen.getByText("Producción")).toBeTruthy();
    expect(screen.getByText("Carga por integrante")).toBeTruthy();
  });

  it("la pestaña Lapsos separa producción y revisión", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Avance frente al plan");
    await user.click(screen.getByRole("tab", { name: /Lapsos/ }));
    expect(screen.getByText("Grabar video")).toBeTruthy();
    expect(screen.getByText(/5 \+ 3 = 8 d/)).toBeTruthy();
  });

  it("la pestaña Componentes lista el árbol con hechas, iniciadas y avance", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Avance frente al plan");
    await user.click(screen.getByRole("tab", { name: "Componentes" }));
    expect(screen.getByText("Unidad 1")).toBeTruthy();
    expect(screen.getByText("Clase A")).toBeTruthy();
    expect(screen.getByText("iniciadas al 60%")).toBeTruthy();

    // Plegar la rama esconde a sus hijos.
    await user.click(screen.getByRole("button", { name: "Plegar Unidad 1" }));
    expect(screen.queryByText("Clase A")).toBeNull();
  });

  it("filtrar componentes por estado pasa a una lista plana con la ruta", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Avance frente al plan");
    await user.click(screen.getByRole("tab", { name: "Componentes" }));
    await user.click(screen.getByRole("button", { name: /Completado/ }));
    expect(screen.queryByText("iniciadas al 60%")).toBeNull();
    expect(screen.getByText("Clase A")).toBeTruthy();
    expect(screen.getByText(/lista plana con su ruta/)).toBeTruthy();
  });

  it("descarga el HTML con el nombre que propone el servidor", async () => {
    const user = userEvent.setup();
    vi.mocked(analyticsApi.downloadHtml).mockResolvedValue({
      blob: new Blob(["<html>"], { type: "text/html" }),
      disposition: 'attachment; filename="informe_Diplomado_IA.html"',
    });
    const createObjectURL = vi.fn().mockReturnValue("blob:fake");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });

    renderPage();
    await screen.findByText("Avance frente al plan");
    await user.click(screen.getByRole("button", { name: /Descargar HTML/i }));

    expect(analyticsApi.downloadHtml).toHaveBeenCalledWith("p1", {});
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  });
});
