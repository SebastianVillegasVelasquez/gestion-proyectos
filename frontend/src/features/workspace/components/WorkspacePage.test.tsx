import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { WorkspacePage } from "./WorkspacePage";

// Comportamiento nuevo: /workspace despacha por rol. Administración ve la consola
// de gestión de equipos; el resto ve su espacio de trabajo de integrante.
const authState = vi.hoisted(() => ({ admin: false }));

vi.mock("react-router", () => ({
  useOutletContext: () => ({ dark: false, toggleDark: vi.fn() }),
}));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Ana", email: "ana@obj.com", role: authState.admin ? "admin" : "user" },
    hasRole: (roles: string[]) => roles.includes(authState.admin ? "admin" : "user"),
  }),
}));

// La consola de admin se prueba aparte; aquí solo verificamos que se elige.
vi.mock("@/features/projects/components/teams/TeamsManagementPage", () => ({
  TeamsManagementPage: () => <div>CONSOLA_EQUIPOS_ADMIN</div>,
}));

// El espacio de integrante depende de datos del backend: lo stubbeamos para
// renderizar su estado vacío sin red.
vi.mock("../hooks/use-workspace", () => ({
  useMyTeams: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useTeamMembers: () => ({ data: [] }),
  useWorkspaceAccess: () => ({ data: { can_deliver: false, can_review: false } }),
  useDeliverables: () => ({ data: [], isLoading: false }),
  useCreateDeliverable: () => ({ mutate: vi.fn(), isPending: false }),
  useAddVersion: () => ({ mutate: vi.fn() }),
  useAddComment: () => ({ mutate: vi.fn() }),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <WorkspacePage />
    </QueryClientProvider>,
  );
}

describe("WorkspacePage dispatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.admin = false;
  });

  it("muestra la consola de gestión de equipos para administración", () => {
    authState.admin = true;
    renderPage();
    expect(screen.getByText("CONSOLA_EQUIPOS_ADMIN")).toBeInTheDocument();
  });

  it("muestra el espacio de integrante para usuarios no administradores", () => {
    authState.admin = false;
    renderPage();
    expect(screen.getByText(/No perteneces a ningún equipo de trabajo/i)).toBeInTheDocument();
    expect(screen.queryByText("CONSOLA_EQUIPOS_ADMIN")).not.toBeInTheDocument();
  });
});
