import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { TasksTable } from "./TasksTable";
import { tasksApi } from "../api/tasks.api";
import { structureApi } from "../api/structure.api";
import type { Task } from "../types/api.types";

vi.mock("../api/tasks.api", () => ({
  tasksApi: {
    listByProject: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    attach: vi.fn(),
    detach: vi.fn(),
    changeStatus: vi.fn(),
  },
}));

vi.mock("../api/structure.api", () => ({
  structureApi: {
    listTypes: vi.fn(),
  },
}));

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "t1",
    project_id: "p1",
    work_item_id: null,
    parent_task_id: null,
    title: "Grabar video intro",
    description: null,
    priority: "media",
    assignee_id: null,
    team_id: null,
    start_date: null,
    due_date: null,
    status: "pendiente_por_iniciar",
    completed_at: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: null,
    estimated_days: null,
    logged_days: "0",
    requires_approval: false,
    ...overrides,
  };
}

const tasks: Task[] = [
  makeTask({ id: "t1", title: "Grabar video intro" }),
  makeTask({ id: "t2", title: "Editar audio" }),
];

function renderTable(isElevated: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(
    <TasksTable
      projectId="p1"
      tasks={tasks}
      members={[]}
      teams={[]}
      tree={[]}
      locationPathById={new Map()}
      currentUserId="u1"
      isElevated={isElevated}
      onOpenDetail={() => {
        /* no-op */
      }}
    />,
    { wrapper: Wrapper },
  );
}

describe("TasksTable — eliminar tareas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(tasksApi.remove).mockResolvedValue(undefined);
    vi.mocked(structureApi.listTypes).mockResolvedValue([]);
  });

  it("no ofrece eliminar a quien no es admin/super_admin/developer", () => {
    renderTable(false);

    expect(screen.queryByLabelText(/Eliminar Grabar video intro/i)).toBeNull();
  });

  it("borra una tarea de su fila tras confirmar en el modal", async () => {
    const user = userEvent.setup();
    renderTable(true);

    await user.click(screen.getByLabelText(/Eliminar Grabar video intro/i));

    // El modal pide confirmar antes de llamar al backend.
    expect(tasksApi.remove).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: /Eliminar tarea/i });
    await user.click(within(dialog).getByRole("button", { name: /^Eliminar$/ }));

    await waitFor(() => {
      expect(tasksApi.remove).toHaveBeenCalledWith("t1");
    });
    expect(tasksApi.remove).toHaveBeenCalledTimes(1);
  });

  it("cancelar el modal no elimina nada", async () => {
    const user = userEvent.setup();
    renderTable(true);

    await user.click(screen.getByLabelText(/Eliminar Grabar video intro/i));
    const dialog = screen.getByRole("dialog", { name: /Eliminar tarea/i });
    await user.click(within(dialog).getByRole("button", { name: /Cancelar/i }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(tasksApi.remove).not.toHaveBeenCalled();
  });

  it("selecciona todas y aplica el borrado en bloque", async () => {
    const user = userEvent.setup();
    renderTable(true);

    await user.click(screen.getByLabelText(/Seleccionar todas/i));
    expect(screen.getByText("2 seleccionadas")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /^Eliminar$/ }));
    const dialog = screen.getByRole("dialog", { name: /Eliminar tareas seleccionadas/i });
    await user.click(within(dialog).getByRole("button", { name: /^Eliminar$/ }));

    await waitFor(() => {
      expect(tasksApi.remove).toHaveBeenCalledWith("t1");
      expect(tasksApi.remove).toHaveBeenCalledWith("t2");
    });
    expect(tasksApi.remove).toHaveBeenCalledTimes(2);
  });
});
