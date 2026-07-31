import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ClientProjectPortal } from "./ClientProjectPortal";
import { portalApi, type PublicProjectProgress } from "../api/portal.api";

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
});
