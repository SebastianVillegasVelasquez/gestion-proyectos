import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { NewTeamTaskModal } from "./NewTeamTaskModal";

const mutateAsync = vi.hoisted(() => vi.fn().mockResolvedValue({}));

vi.mock("../hooks/use-workspace", () => ({
  useCreateTeamTask: () => ({ mutateAsync, isPending: false }),
  useTeamMembers: () => ({
    data: [
      { user_id: "u1", name: "Ana", last_name: "Ruiz", position: "dev", team_role: "integrante" },
    ],
  }),
}));

vi.mock("@/features/projects/hooks/use-structure", () => ({
  useWorkTree: () => ({
    data: [
      {
        id: "n1",
        nombre: "Módulo 1",
        children: [{ id: "n2", nombre: "Unidad 1", children: [] }],
      },
    ],
  }),
}));

describe("NewTeamTaskModal", () => {
  beforeEach(() => {
    mutateAsync.mockClear();
  });

  it("crea una tarea de bolsa con elemento y sin responsable", async () => {
    const onClose = vi.fn();
    render(<NewTeamTaskModal teamId="t1" projectId="p1" onClose={onClose} />);

    await userEvent.type(screen.getByPlaceholderText(/guion del módulo/i), "Nueva X");
    await userEvent.selectOptions(screen.getByLabelText(/elemento de la estructura/i), "n2");
    await userEvent.click(screen.getByRole("button", { name: /crear tarea/i }));

    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Nueva X",
        work_item_id: "n2",
        assignee_id: null,
      }),
    );
  });

  it("valida el título mínimo", async () => {
    render(<NewTeamTaskModal teamId="t1" projectId="p1" onClose={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/guion del módulo/i), "x");
    await userEvent.click(screen.getByRole("button", { name: /crear tarea/i }));
    expect(screen.getByText(/al menos 2 caracteres/i)).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
