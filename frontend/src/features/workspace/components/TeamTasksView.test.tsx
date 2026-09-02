import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { TeamTasksView } from "./TeamTasksView";
import { useTeamTasks, useWorkspaceAccess } from "../hooks/use-workspace";
import type * as useWorkspaceModule from "../hooks/use-workspace";
import {
  useUpdateTask,
  useDeleteTask,
  useChangeTaskStatus,
} from "@/features/projects/hooks/use-tasks";
import { useWorkTree, useNodeTypes } from "@/features/projects/hooks/use-structure";
import type { ApiTeamTask } from "../api/workspace.api";

vi.mock("../hooks/use-workspace", async (importOriginal) => {
  const actual = await importOriginal<typeof useWorkspaceModule>();
  return {
    ...actual,
    useTeamTasks: vi.fn(),
    useWorkspaceAccess: vi.fn(),
  };
});

vi.mock("@/features/projects/hooks/use-tasks", () => ({
  useUpdateTask: vi.fn(),
  useDeleteTask: vi.fn(),
  useChangeTaskStatus: vi.fn(),
  useTaskDependencies: () => ({ data: [] }),
  useAddTaskDependency: () => ({ mutate: vi.fn(), isPending: false }),
  useRemoveTaskDependency: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u1", name: "Ana" } }),
}));

vi.mock("@/features/projects/hooks/use-structure", () => ({
  useWorkTree: vi.fn(),
  useNodeTypes: vi.fn(),
}));

function task(over: Partial<ApiTeamTask> = {}): ApiTeamTask {
  return {
    id: "t1",
    title: "Grabar video intro",
    status: "pendiente_por_iniciar",
    priority: "media",
    work_item_id: null,
    work_item_name: null,
    project_id: "p1",
    project_name: "Proyecto",
    assignee_id: "u1",
    assignee_name: "Ana",
    parent_task_id: null,
    start_date: null,
    due_date: null,
    requires_approval: false,
    progress_pct: 0,
    blocked_by: [],
    depends_on_third_party: false,
    ...over,
  };
}

function renderView(canReview: boolean, tasks: ApiTeamTask[]) {
  vi.mocked(useTeamTasks).mockReturnValue({
    data: tasks,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as never);
  vi.mocked(useWorkspaceAccess).mockReturnValue({
    data: {
      team_role: canReview ? "lider" : "integrante",
      can_view: true,
      can_deliver: true,
      can_review: canReview,
    },
  } as never);
  vi.mocked(useWorkTree).mockReturnValue({ data: [] } as never);
  vi.mocked(useNodeTypes).mockReturnValue({ data: [] } as never);

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(<TeamTasksView teamId="team1" projectId="p1" members={[]} teamMembers={[]} />, {
    wrapper: Wrapper,
  });
}

/**
 * La vista abre filtrada a "sin asignar" (la bolsa del equipo). Estos tests
 * trabajan con tareas ya asignadas, así que primero pulsan "Todas".
 */
async function showAllAssignees(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Todas" }));
}

describe("TeamTasksView — edición y borrado de tareas del equipo", () => {
  const deleteMutate = vi.fn();
  const updateMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDeleteTask).mockReturnValue({
      mutate: deleteMutate,
      isPending: false,
    } as never);
    vi.mocked(useUpdateTask).mockReturnValue({
      mutate: updateMutate,
      isPending: false,
    } as never);
    vi.mocked(useChangeTaskStatus).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
  });

  it("no ofrece editar ni eliminar a quien no lidera el equipo", () => {
    renderView(false, [task()]);

    expect(screen.queryByLabelText(/Editar Grabar video intro/i)).toBeNull();
    expect(screen.queryByLabelText(/Eliminar Grabar video intro/i)).toBeNull();
  });

  it("cancelar el borrado no llama a la mutación", async () => {
    const user = userEvent.setup();
    renderView(true, [task()]);

    await showAllAssignees(user);

    await user.click(screen.getByLabelText(/Eliminar Grabar video intro/i));
    const dialog = screen.getByRole("dialog", { name: /Eliminar tarea/i });
    await user.click(within(dialog).getByRole("button", { name: /Cancelar/i }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(deleteMutate).not.toHaveBeenCalled();
  });

  it("confirmar el borrado llama a useDeleteTask con el id de la tarea", async () => {
    const user = userEvent.setup();
    renderView(true, [task({ id: "t9", title: "Editar audio" })]);

    await showAllAssignees(user);

    await user.click(screen.getByLabelText(/Eliminar Editar audio/i));
    const dialog = screen.getByRole("dialog", { name: /Eliminar tarea/i });
    await user.click(within(dialog).getByRole("button", { name: /^Eliminar$/ }));

    await waitFor(() => {
      expect(deleteMutate).toHaveBeenCalledWith("t9", expect.anything());
    });
  });

  it("editar abre el formulario precargado con el título de la tarea", async () => {
    const user = userEvent.setup();
    renderView(true, [task({ title: "Montaje final" })]);

    await showAllAssignees(user);

    await user.click(screen.getByLabelText(/Editar Montaje final/i));
    expect(await screen.findByText("Editar tarea")).toBeTruthy();
    expect(screen.getByDisplayValue("Montaje final")).toBeTruthy();
  });
});

describe("TeamTasksView — botón Comenzar", () => {
  const startMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDeleteTask).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
    vi.mocked(useUpdateTask).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
    vi.mocked(useChangeTaskStatus).mockReturnValue({
      mutate: startMutate,
      isPending: false,
    } as never);
  });

  it("aparece en la tarea propia sin iniciar y la pasa a en_progreso", async () => {
    const user = userEvent.setup();
    // task() por defecto: assignee_id "u1" (== usuario mock) y pendiente_por_iniciar.
    // El integrante abre la vista ya filtrada a sus tareas: no hay chip "Todas".
    renderView(false, [task({ id: "mine", title: "Lo mío" })]);

    await user.click(await screen.findByRole("button", { name: /Comenzar/i }));
    expect(startMutate).toHaveBeenCalledWith(
      { taskId: "mine", status: "en_progreso" },
      expect.anything(),
    );
  });

  it("no aparece en la tarea de otra persona", () => {
    renderView(false, [task({ assignee_id: "otro", assignee_name: "Otro" })]);
    expect(screen.queryByRole("button", { name: /Comenzar/i })).toBeNull();
  });

  it("no aparece si la tarea ya está en progreso", () => {
    renderView(false, [task({ status: "en_progreso" })]);
    expect(screen.queryByRole("button", { name: /Comenzar/i })).toBeNull();
  });

  it("no aparece en la tarea padre: solo en sus subtareas", async () => {
    const user = userEvent.setup();
    renderView(false, [
      task({ id: "parent", title: "Tarea padre" }),
      task({ id: "child", title: "Subtarea", parent_task_id: "parent" }),
    ]);
    // Subtareas colapsadas por defecto: el padre no trae "Comenzar".
    expect(screen.queryByRole("button", { name: /Comenzar/i })).toBeNull();
    // Al desplegar aparece el "Comenzar" de la subtarea (y solo ese).
    await user.click(await screen.findByRole("button", { name: /Ver subtareas/i }));
    const buttons = await screen.findAllByRole("button", { name: /Comenzar/i });
    expect(buttons).toHaveLength(1);
  });
});
