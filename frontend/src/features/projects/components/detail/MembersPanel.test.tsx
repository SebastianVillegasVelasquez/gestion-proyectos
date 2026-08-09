import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { MembersPanel } from "./MembersPanel";
import { membersApi } from "../../api/members.api";
import type { ProjectMember } from "../../types/api.types";

vi.mock("../../api/members.api", () => ({
  membersApi: { list: vi.fn(), add: vi.fn(), updateRole: vi.fn(), remove: vi.fn() },
  usersApi: { list: vi.fn() },
  directoryApi: { list: vi.fn(), search: vi.fn() },
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
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<MembersPanel projectId="p1" />, { wrapper: Wrapper });
}

const members: ProjectMember[] = [
  {
    id: "m1",
    user_id: "u1",
    name: "Ana",
    last_name: "García",
    email: "ana@acme.com",
    position: "desarrollador",
    project_role: "integrante",
  },
  {
    id: "m2",
    user_id: "u2",
    name: "Beto",
    last_name: "López",
    email: "beto@acme.com",
    position: "experto_tematico",
    project_role: "coordinador",
  },
];

describe("MembersPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists the project members once loaded", async () => {
    vi.mocked(membersApi.list).mockResolvedValue(members);
    renderPanel();

    expect(await screen.findByText("Ana García")).toBeInTheDocument();
    expect(screen.getByText("Beto López")).toBeInTheDocument();
  });

  it("filters by name as the user types", async () => {
    vi.mocked(membersApi.list).mockResolvedValue(members);
    renderPanel();
    await screen.findByText("Ana García");

    await userEvent.type(screen.getByLabelText("Buscar integrante"), "beto");

    expect(screen.queryByText("Ana García")).not.toBeInTheDocument();
    expect(screen.getByText("Beto López")).toBeInTheDocument();
  });

  it("filters by cargo using its readable label", async () => {
    vi.mocked(membersApi.list).mockResolvedValue(members);
    renderPanel();
    await screen.findByText("Ana García");

    await userEvent.type(screen.getByLabelText("Buscar integrante"), "desarrollador");

    expect(screen.getByText("Ana García")).toBeInTheDocument();
    expect(screen.queryByText("Beto López")).not.toBeInTheDocument();
  });

  it("shows a no-results message when nothing matches", async () => {
    vi.mocked(membersApi.list).mockResolvedValue(members);
    renderPanel();
    await screen.findByText("Ana García");

    await userEvent.type(screen.getByLabelText("Buscar integrante"), "zzz");

    await waitFor(() => {
      expect(screen.getByText(/Ningún integrante coincide/)).toBeInTheDocument();
    });
  });
});
