import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ProjectReportPage } from "./ProjectReportPage";
import { reportsApi } from "../api/reports.api";
import type { ProjectReport } from "../api/reports.api";

vi.mock("../api/reports.api", () => ({
  reportsApi: { get: vi.fn(), downloadCsv: vi.fn() },
}));

vi.mock("react-router", () => ({
  useParams: () => ({ projectId: "p1" }),
  useNavigate: () => vi.fn(),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<ProjectReportPage />, { wrapper: Wrapper });
}

function report(over: Partial<ProjectReport> = {}): ProjectReport {
  return {
    project_id: "p1",
    project_name: "Diplomado IA",
    total_tareas: 2,
    tareas_por_estado: { pendiente_por_iniciar: 1, completada: 1 },
    horas_estimadas: "12",
    horas_dedicadas: "5",
    horas_por_persona: [{ nombre: "Ana García", horas: "5" }],
    filas: [
      {
        elemento: "Unidad 1",
        elemento_tipo_id: "tipo-1",
        tarea: "Grabar video",
        responsable: "Ana García",
        equipo: null,
        estado: "pendiente_por_iniciar",
        prioridad: "media",
        inicio: "2026-08-20",
        fin: "2026-08-28",
        horas_estimadas: "8",
        horas_dedicadas: "5",
      },
      {
        elemento: "Unidad 1",
        elemento_tipo_id: "tipo-1",
        tarea: "Editar video",
        responsable: null,
        equipo: "Producción",
        estado: "completada",
        prioridad: "alta",
        inicio: null,
        fin: null,
        horas_estimadas: "4",
        horas_dedicadas: "0",
      },
    ],
    ...over,
  };
}

describe("ProjectReportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reportsApi.get).mockResolvedValue(report());
  });

  it("resume tareas y horas del proyecto", async () => {
    renderPage();

    // El nombre va tras la flecha de volver, en el mismo botón.
    expect(await screen.findByRole("button", { name: /Diplomado IA/ })).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText(/de 12 h/)).toBeTruthy();
  });

  it("desglosa las horas por persona", async () => {
    renderPage();

    expect(await screen.findByText("Horas por persona")).toBeTruthy();
    expect(screen.getAllByText("Ana García").length).toBeGreaterThan(0);
  });

  it("lista cada tarea con su elemento y su dedicación", async () => {
    renderPage();

    expect(await screen.findByText("Grabar video")).toBeTruthy();
    expect(screen.getByText("Editar video")).toBeTruthy();
    // Sin responsable individual se muestra el equipo, no un hueco.
    expect(screen.getByText("Producción")).toBeTruthy();
  });

  it("descarga el CSV con el nombre que propone el servidor", async () => {
    const user = userEvent.setup();
    vi.mocked(reportsApi.downloadCsv).mockResolvedValue({
      blob: new Blob(["a;b"], { type: "text/csv" }),
      disposition: 'attachment; filename="informe_Diplomado_IA.csv"',
    });
    // jsdom no implementa la API de object URLs.
    const createObjectURL = vi.fn().mockReturnValue("blob:fake");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });

    renderPage();
    await screen.findByText("Grabar video");
    await user.click(screen.getByRole("button", { name: /Descargar CSV/i }));

    await waitFor(() => {
      expect(reportsApi.downloadCsv).toHaveBeenCalledWith("p1");
    });
    // La URL temporal se libera: si no, el blob se queda en memoria.
    await waitFor(() => {
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake");
    });
  });

  it("avisa si la descarga falla, sin romper la pantalla", async () => {
    const user = userEvent.setup();
    vi.mocked(reportsApi.downloadCsv).mockRejectedValue(new Error("boom"));

    renderPage();
    await screen.findByText("Grabar video");
    await user.click(screen.getByRole("button", { name: /Descargar CSV/i }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("Grabar video")).toBeTruthy();
  });

  it("dice que no hay tareas cuando el proyecto está vacío", async () => {
    vi.mocked(reportsApi.get).mockResolvedValue(
      report({ total_tareas: 0, filas: [], horas_por_persona: [], tareas_por_estado: {} }),
    );
    renderPage();

    expect(await screen.findByText(/todavía no tiene tareas/i)).toBeTruthy();
    expect(screen.getByText(/Nadie ha registrado horas/i)).toBeTruthy();
  });
});
