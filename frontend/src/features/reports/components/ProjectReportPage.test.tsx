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
        logged_hours: 12,
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
    expect(screen.getByText("40%")).toBeTruthy(); // avance
    expect(screen.getByText("Retrabajo")).toBeTruthy();
  });

  it("cambia de pestaña a Equipos y muestra su tabla", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("40%");
    await user.click(screen.getByRole("button", { name: "Equipos" }));
    expect(screen.getByText("Producción")).toBeTruthy();
    expect(screen.getByText("Carga por integrante")).toBeTruthy();
  });

  it("la pestaña Lapsos separa producción y revisión", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("40%");
    await user.click(screen.getByRole("button", { name: /Lapsos/ }));
    expect(screen.getByText("Grabar video")).toBeTruthy();
    expect(screen.getByText(/5 \+ 3 = 8 d/)).toBeTruthy();
  });

  it("tiene el bloque de resumen por IA (placeholder de fase 6.2)", async () => {
    renderPage();
    expect(await screen.findByText("Resumen por IA")).toBeTruthy();
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
    await screen.findByText("40%");
    await user.click(screen.getByRole("button", { name: /Descargar HTML/i }));

    expect(analyticsApi.downloadHtml).toHaveBeenCalledWith("p1", {});
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  });
});
