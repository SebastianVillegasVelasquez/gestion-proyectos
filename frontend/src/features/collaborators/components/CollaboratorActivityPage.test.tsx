import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { CollaboratorActivityPage } from "./CollaboratorActivityPage";
import { collaboratorsApi } from "../api/collaborators.api";
import type { CollaboratorActivity } from "../types";

vi.mock("react-router", () => ({
  useParams: () => ({ userId: "u1" }),
  useNavigate: () => vi.fn(),
}));

vi.mock("../api/collaborators.api", () => ({
  collaboratorsApi: { list: vi.fn(), activity: vi.fn() },
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<CollaboratorActivityPage />, { wrapper: Wrapper });
}

// Actividad real con historial vacío (caso típico hoy: aún no hay TaskHistory).
const emptyActivity: CollaboratorActivity = {
  user_id: "u1",
  name: "Carlos",
  last_name: "Pérez",
  email: "carlos@acme.com",
  position: "desarrollador",
  assigned_tasks: 0,
  completed_tasks: 0,
  in_progress_tasks: 0,
  completion_pct: 0,
  project_count: 0,
  team_count: 0,
  tasks: [],
  history: [],
};

describe("CollaboratorActivityPage — vista previa de trazabilidad", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(collaboratorsApi.activity).mockResolvedValue(emptyActivity);
  });

  it("muestra el aviso y el historial de ejemplo al activar el toggle", async () => {
    renderPage();
    await screen.findByText("Carlos Pérez");

    await userEvent.click(screen.getByRole("button", { name: "Datos de ejemplo" }));

    expect(screen.getByText("Salir del ejemplo")).toBeInTheDocument();
    // Una entrada del historial de ejemplo (el motivo se muestra entre comillas).
    expect(screen.getByText(/Avanzo el 60%/)).toBeInTheDocument();
  });

  it("ofrece previsualizar desde el estado vacío del historial", async () => {
    renderPage();
    await screen.findByText("Sin actividad registrada.");

    await userEvent.click(screen.getByRole("button", { name: "Ver datos de ejemplo" }));

    // Pasa a modo ejemplo: aparece el aviso y deja de estar vacío.
    expect(screen.getByText("Salir del ejemplo")).toBeInTheDocument();
    expect(screen.queryByText("Sin actividad registrada.")).not.toBeInTheDocument();
  });
});
