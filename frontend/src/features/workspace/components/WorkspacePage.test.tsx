import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { WorkspacePage } from "./WorkspacePage";

// Comportamiento actual: /workspace es siempre el espacio personal del usuario
// (sus equipos, entregables y revisiones), sin importar su rol. La gestión de
// equipos ahora vive dentro de cada proyecto (ProjectTeamsPage), no aquí.
const authState = vi.hoisted(() => ({ admin: false }));

vi.mock("react-router", () => ({
  useOutletContext: () => ({ dark: false, toggleDark: vi.fn() }),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Ana", email: "ana@obj.com", role: authState.admin ? "admin" : "user" },
    hasRole: (roles: string[]) => roles.includes(authState.admin ? "admin" : "user"),
  }),
}));

// El espacio de integrante depende de datos del backend: lo stubbeamos para
// renderizar su estado vacío sin red.
vi.mock("../hooks/use-workspace", () => ({
  useMyTeams: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useTeamMembers: () => ({ data: [] }),
  useWorkspaceAccess: () => ({ data: { can_deliver: false, can_review: false } }),
  useDeliverables: () => ({ data: [], isLoading: false }),
  useTeamTasks: () => ({ data: [], isLoading: false }),
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

describe("WorkspacePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.admin = false;
  });

  it("muestra el espacio de integrante para usuarios no administradores", () => {
    authState.admin = false;
    renderPage();
    expect(screen.getByText(/No perteneces a ningún equipo de trabajo/i)).toBeInTheDocument();
  });

  it("muestra el mismo espacio personal para administración (ya no hay consola global de equipos)", () => {
    authState.admin = true;
    renderPage();
    expect(screen.getByText(/No perteneces a ningún equipo de trabajo/i)).toBeInTheDocument();
  });
});
