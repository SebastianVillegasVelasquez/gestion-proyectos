import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ClientProjectPortal } from "./ClientProjectPortal";
import { portalApi, type PublicProjectProgress } from "../api/portal.api";

vi.mock("react-router", () => ({
  useParams: () => ({ token: "tok-123" }),
}));

vi.mock("../api/portal.api", () => ({
  portalApi: { getProgress: vi.fn() },
}));

function renderPortal() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<ClientProjectPortal />, { wrapper: Wrapper });
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

  it("shows the project name, progress and status on success", async () => {
    vi.mocked(portalApi.getProgress).mockResolvedValue(progress);
    renderPortal();

    expect(await screen.findByText("Diplomado en Analítica")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("En marcha")).toBeInTheDocument();
    // El nuevo portal sólo muestra Avance general + resumen automático (sin
    // desglose de tareas). Verificamos que la sección del resumen esté presente.
    expect(screen.getByText("Resumen automático")).toBeInTheDocument();
  });

  it("shows a friendly error when the token is invalid", async () => {
    vi.mocked(portalApi.getProgress).mockRejectedValue(new Error("404"));
    renderPortal();

    expect(await screen.findByText("Enlace no válido o expirado")).toBeInTheDocument();
  });
});
