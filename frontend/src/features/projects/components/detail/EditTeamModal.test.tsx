import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { EditTeamModal } from "./EditTeamModal";
import { teamsApi } from "../../api/teams.api";
import type { Team } from "../../types/api.types";

vi.mock("../../api/teams.api", () => ({
  teamsApi: { list: vi.fn(), get: vi.fn(), update: vi.fn(), remove: vi.fn(), members: vi.fn() },
}));

const team: Team = {
  id: "t1",
  name: "Equipo de Desarrollo",
  description: "Backend y frontend",
  member_count: 4,
};

function renderModal(onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  render(<EditTeamModal team={team} onClose={onClose} />, { wrapper: Wrapper });
  return { onClose };
}

describe("EditTeamModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefills the form with the current team values", () => {
    renderModal();
    expect(screen.getByLabelText("Nombre del equipo")).toHaveValue("Equipo de Desarrollo");
    expect(screen.getByLabelText("Descripción del equipo")).toHaveValue("Backend y frontend");
  });

  it("submits the edited values and closes on success", async () => {
    vi.mocked(teamsApi.update).mockResolvedValue({ ...team, name: "Equipo Renombrado" });
    const { onClose } = renderModal();

    const nameInput = screen.getByLabelText("Nombre del equipo");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Equipo Renombrado");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(teamsApi.update).toHaveBeenCalledWith("t1", {
        name: "Equipo Renombrado",
        description: "Backend y frontend",
      });
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("disables submit when the name is too short", async () => {
    renderModal();
    const nameInput = screen.getByLabelText("Nombre del equipo");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "a");

    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
  });

  it("sends a null description when cleared", async () => {
    vi.mocked(teamsApi.update).mockResolvedValue(team);
    renderModal();

    await userEvent.clear(screen.getByLabelText("Descripción del equipo"));
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(teamsApi.update).toHaveBeenCalledWith("t1", {
        name: "Equipo de Desarrollo",
        description: null,
      });
    });
  });

  it("shows a clear error message when the update fails", async () => {
    vi.mocked(teamsApi.update).mockRejectedValue({
      response: { data: { detail: "Ya existe un equipo con ese nombre" } },
    });
    renderModal();

    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Ya existe un equipo con ese nombre")).toBeInTheDocument();
  });
});
