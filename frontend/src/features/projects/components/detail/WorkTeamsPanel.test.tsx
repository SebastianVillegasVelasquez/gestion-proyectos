import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type { ReactNode } from "react";

import { WorkTeamsPanel } from "./WorkTeamsPanel";
import { teamsApi } from "../../api/teams.api";
import type { PaginatedTeams } from "../../types/api.types";

vi.mock("../../api/teams.api", () => ({
  teamsApi: { list: vi.fn(), get: vi.fn(), members: vi.fn() },
}));

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(<WorkTeamsPanel />, { wrapper: Wrapper });
}

const page = (items: PaginatedTeams["items"]): PaginatedTeams => ({
  items,
  total: items.length,
  page: 1,
  page_size: 50,
});

const teams = page([
  { id: "1", name: "Equipo de Desarrollo", description: "Backend y frontend", member_count: 5 },
  { id: "2", name: "Diseño", description: "Identidad visual", member_count: 3 },
]);

describe("WorkTeamsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists the teams once loaded, with their member count", async () => {
    vi.mocked(teamsApi.list).mockResolvedValue(teams);
    renderPanel();

    expect(await screen.findByText("Equipo de Desarrollo")).toBeInTheDocument();
    expect(screen.getByText("Diseño")).toBeInTheDocument();
    expect(screen.getByText("5 integrantes")).toBeInTheDocument();
  });

  it("links each team to its detail page", async () => {
    vi.mocked(teamsApi.list).mockResolvedValue(teams);
    renderPanel();

    const link = await screen.findByLabelText("Ver detalle del equipo Equipo de Desarrollo");
    expect(link).toHaveAttribute("href", "/teams/1");
  });

  it("filters teams by name as the user types", async () => {
    vi.mocked(teamsApi.list).mockResolvedValue(teams);
    renderPanel();
    await screen.findByText("Equipo de Desarrollo");

    await userEvent.type(screen.getByLabelText("Buscar equipo"), "diseño");

    expect(screen.queryByText("Equipo de Desarrollo")).not.toBeInTheDocument();
    expect(screen.getByText("Diseño")).toBeInTheDocument();
  });

  it("shows a no-results message when nothing matches the search", async () => {
    vi.mocked(teamsApi.list).mockResolvedValue(teams);
    renderPanel();
    await screen.findByText("Equipo de Desarrollo");

    await userEvent.type(screen.getByLabelText("Buscar equipo"), "marketing");

    await waitFor(() => {
      expect(screen.getByText(/Ningún equipo coincide/)).toBeInTheDocument();
    });
  });

  it("shows an empty state when there are no teams", async () => {
    vi.mocked(teamsApi.list).mockResolvedValue(page([]));
    renderPanel();

    expect(await screen.findByText("Aún no hay equipos de trabajo")).toBeInTheDocument();
  });

  it("shows a clear error message with retry when the request fails", async () => {
    vi.mocked(teamsApi.list).mockRejectedValue(new Error("network down"));
    renderPanel();

    expect(await screen.findByText("No se pudieron cargar los equipos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reintentar/ })).toBeInTheDocument();
  });
});
