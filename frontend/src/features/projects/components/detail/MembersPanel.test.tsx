import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

import { MembersPanel } from "./MembersPanel";
import { membersApi } from "../../api/members.api";
import type { ProjectMemberProgress } from "../../types/api.types";

vi.mock("../../api/members.api", () => ({
  membersApi: {
    list: vi.fn(),
    progress: vi.fn(),
    add: vi.fn(),
    updateRole: vi.fn(),
    remove: vi.fn(),
  },
  usersApi: { list: vi.fn() },
  directoryApi: { list: vi.fn(), search: vi.fn() },
}));

vi.mock("../../hooks/use-tasks", () => ({
  useProjectTasks: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Ana", email: "ana@obj.com", role: "user" },
    hasRole: (roles: string[]) => roles.includes("user"),
  }),
}));

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(<MembersPanel projectId="p1" />, { wrapper: Wrapper });
}

const members: ProjectMemberProgress[] = [
  {
    id: "m1",
    user_id: "u1",
    name: "Ana",
    last_name: "García",
    email: "ana@acme.com",
    position: "desarrollador",
    project_role: "integrante",
    tasks_total: 4,
    tasks_completed: 2,
    progress_pct: 50,
    team_names: ["Diseño"],
    team_ids: ["team-1"],
  },
  {
    id: "m2",
    user_id: "u2",
    name: "Beto",
    last_name: "López",
    email: "beto@acme.com",
    position: "experto_tematico",
    project_role: "coordinador",
    tasks_total: 3,
    tasks_completed: 3,
    progress_pct: 100,
    team_names: [],
    team_ids: [],
  },
];

describe("MembersPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists the project members once loaded", async () => {
    vi.mocked(membersApi.progress).mockResolvedValue(members);
    renderPanel();

    expect(await screen.findByText("Ana García")).toBeInTheDocument();
    expect(screen.getByText("Beto López")).toBeInTheDocument();
  });

  it("shows each member's weighted progress", async () => {
    vi.mocked(membersApi.progress).mockResolvedValue(members);
    renderPanel();

    await screen.findByText("Ana García");
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText(/Listo para pago/)).toBeInTheDocument();
  });

  it("filters by name as the user types", async () => {
    vi.mocked(membersApi.progress).mockResolvedValue(members);
    renderPanel();
    await screen.findByText("Ana García");

    await userEvent.type(screen.getByLabelText("Buscar integrante"), "beto");

    expect(screen.queryByText("Ana García")).not.toBeInTheDocument();
    expect(screen.getByText("Beto López")).toBeInTheDocument();
  });

  it("filters by cargo using its readable label", async () => {
    vi.mocked(membersApi.progress).mockResolvedValue(members);
    renderPanel();
    await screen.findByText("Ana García");

    await userEvent.type(screen.getByLabelText("Buscar integrante"), "desarrollador");

    expect(screen.getByText("Ana García")).toBeInTheDocument();
    expect(screen.queryByText("Beto López")).not.toBeInTheDocument();
  });

  it("shows a no-results message when nothing matches", async () => {
    vi.mocked(membersApi.progress).mockResolvedValue(members);
    renderPanel();
    await screen.findByText("Ana García");

    await userEvent.type(screen.getByLabelText("Buscar integrante"), "zzz");

    await waitFor(() => {
      expect(screen.getByText(/Ningún integrante coincide/)).toBeInTheDocument();
    });
  });

  it("sorts by avance (progress) when the column header is clicked", async () => {
    vi.mocked(membersApi.progress).mockResolvedValue(members);
    renderPanel();
    await screen.findByText("Ana García");

    await userEvent.click(screen.getByRole("button", { name: "Ordenar por Avance" }));

    const rows = screen.getAllByRole("row").slice(1); // sin el header
    expect(rows[0]).toHaveTextContent("Ana García");
    expect(rows[1]).toHaveTextContent("Beto López");
  });
});
