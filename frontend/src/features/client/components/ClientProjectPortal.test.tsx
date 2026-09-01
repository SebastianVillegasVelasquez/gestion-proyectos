import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ClientProjectPortal } from "./ClientProjectPortal";
import {
  portalApi,
  type PublicProjectProgress,
  type PublicProjectSchedule,
} from "../api/portal.api";

vi.mock("../api/portal.api", () => ({
  portalApi: { getProgress: vi.fn(), getSchedule: vi.fn() },
}));

function renderPortal() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<ClientProjectPortal />, { wrapper: Wrapper });
}

/** Escribe un token en el formulario de acceso y lo envía. */
function submitToken(token: string) {
  fireEvent.change(screen.getByPlaceholderText("Pega aquí tu token"), {
    target: { value: token },
  });
  fireEvent.click(screen.getByRole("button", { name: /ver mi proyecto/i }));
}

const progress: PublicProjectProgress = {
  name: "Diplomado en Analítica",
  client_name: "Unicafam",
  coordinator: "Ana García",
  status: "active",
  tasks_total: 10,
  tasks_completed: 4,
  tasks_in_review: 2,
  tasks_overdue: 1,
  tasks_pending: 3,
  progress_pct: 40,
};

describe("ClientProjectPortal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asks for the token first and does not fetch on mount", () => {
    renderPortal();

    expect(screen.getByText("Introduce tu token de acceso")).toBeInTheDocument();
    expect(portalApi.getProgress).not.toHaveBeenCalled();
  });

  it("posts the token and shows the project name, progress and status on success", async () => {
    vi.mocked(portalApi.getProgress).mockResolvedValue(progress);
    renderPortal();

    submitToken("tok-123");

    expect(await screen.findByText("Diplomado en Analítica")).toBeInTheDocument();
    expect(portalApi.getProgress).toHaveBeenCalledWith("tok-123");
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("En marcha")).toBeInTheDocument();
    // El portal muestra Avance general + resumen automático (sin desglose de tareas).
    expect(screen.getByText("Resumen automático")).toBeInTheDocument();
  });

  it("shows a friendly error when the token is invalid", async () => {
    vi.mocked(portalApi.getProgress).mockRejectedValue(new Error("404"));
    renderPortal();

    submitToken("bad-token");

    expect(await screen.findByText(/Token no válido o expirado/)).toBeInTheDocument();
  });

  it("loads the schedule (parent elements only, no tasks) lazily when the Cronograma tab is opened", async () => {
    const schedule: PublicProjectSchedule = {
      project_name: "Diplomado en Analítica",
      items: [
        {
          key: "n0",
          parent_key: null,
          name: "Módulo 1",
          depth: 0,
          order: 0,
          start_date: "2026-07-01",
          due_date: "2026-07-20",
          status: "en_progreso",
          progress_pct: 45,
          tipo_id: "t-modulo",
          tipo_nombre: "Módulo",
          es_dependencia_externa: false,
        },
        {
          key: "n1",
          parent_key: "n0",
          name: "Unidad 1",
          depth: 1,
          order: 1,
          start_date: "2026-07-02",
          due_date: "2026-07-10",
          status: "completada",
          progress_pct: 100,
          tipo_id: "t-unidad",
          tipo_nombre: "Unidad",
          es_dependencia_externa: false,
        },
      ],
    };
    vi.mocked(portalApi.getProgress).mockResolvedValue(progress);
    vi.mocked(portalApi.getSchedule).mockResolvedValue(schedule);
    renderPortal();

    submitToken("tok-123");
    await screen.findByText("Diplomado en Analítica");
    // Aún en la pestaña Resumen: el cronograma no se ha pedido.
    expect(portalApi.getSchedule).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /cronograma/i }));

    // Muestra los elementos de la estructura, nunca responsables ni equipos.
    expect(await screen.findByText("Módulo 1")).toBeInTheDocument();
    expect(screen.getByText("Unidad 1")).toBeInTheDocument();
    expect(portalApi.getSchedule).toHaveBeenCalledWith("tok-123");
    expect(screen.queryByLabelText(/responsable/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/equipo/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/responsabilidad/i)).not.toBeInTheDocument();
    // Conserva la búsqueda por nombre del elemento.
    expect(screen.getByLabelText(/buscar componente/i)).toBeInTheDocument();
  });
});
