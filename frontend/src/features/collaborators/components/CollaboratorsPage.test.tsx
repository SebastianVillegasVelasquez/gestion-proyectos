import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { CollaboratorsPage } from "./CollaboratorsPage";
import { collaboratorsApi } from "../api/collaborators.api";
import type { CollaboratorListItem, PaginatedCollaborators } from "../types";

const mockNavigate = vi.fn();

vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
  useOutletContext: () => ({ dark: false, toggleDark: vi.fn() }),
}));

vi.mock("../api/collaborators.api", () => ({
  collaboratorsApi: { list: vi.fn(), activity: vi.fn() },
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<CollaboratorsPage />, { wrapper: Wrapper });
}

function item(over: Partial<CollaboratorListItem> = {}): CollaboratorListItem {
  return {
    user_id: "u1",
    name: "Ana",
    last_name: "García",
    position: "desarrollador",
    assigned_tasks: 10,
    completed_tasks: 5,
    completion_pct: 50,
    ...over,
  };
}

function page(over: Partial<PaginatedCollaborators> = {}): PaginatedCollaborators {
  return { items: [item()], total: 1, page: 1, page_size: 10, ...over };
}

describe("CollaboratorsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a row with name, position label and completion percentage", async () => {
    vi.mocked(collaboratorsApi.list).mockResolvedValue(page());
    renderPage();

    expect(await screen.findByText("Ana García")).toBeInTheDocument();
    expect(screen.getByText("Desarrollador")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("5/10 tareas")).toBeInTheDocument();
  });

  it("navigates to the detail page when a row is clicked", async () => {
    vi.mocked(collaboratorsApi.list).mockResolvedValue(page());
    renderPage();

    const row = await screen.findByRole("button", { name: /Ver actividad de Ana García/ });
    await userEvent.click(row);

    expect(mockNavigate).toHaveBeenCalledWith("/collaborators/u1");
  });

  it("disables both pager buttons on a single page", async () => {
    vi.mocked(collaboratorsApi.list).mockResolvedValue(page({ total: 1 }));
    renderPage();
    await screen.findByText("Ana García");

    expect(screen.getByText("Página 1 de 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Página anterior")).toBeDisabled();
    expect(screen.getByLabelText("Página siguiente")).toBeDisabled();
  });

  it("requests the next page when clicking next", async () => {
    // 25 results over a page size of 10 → 3 pages.
    vi.mocked(collaboratorsApi.list).mockResolvedValue(
      page({ total: 25, items: [item({ user_id: "u1" })] }),
    );
    renderPage();
    await screen.findByText("Ana García");

    await userEvent.click(screen.getByLabelText("Página siguiente"));

    await waitFor(() => {
      expect(collaboratorsApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, pageSize: 10 }),
      );
    });
  });

  it("shows an empty state when there are no users", async () => {
    vi.mocked(collaboratorsApi.list).mockResolvedValue(page({ items: [], total: 0 }));
    renderPage();

    expect(await screen.findByText("Aún no hay usuarios")).toBeInTheDocument();
  });
});
