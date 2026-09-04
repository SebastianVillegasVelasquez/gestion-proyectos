import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps, ReactNode } from "react";

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
    delivery_blocked_reason: null,
    ...over,
  };
}

function renderView(
  canReview: boolean,
  tasks: ApiTeamTask[],
  deliverProps: Partial<
    Pick<ComponentProps<typeof TeamTasksView>, "onDeliver" | "onMarkDelivered" | "canDeliverTask">
  > = {},
) {
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
  return render(
    <TeamTasksView teamId="team1" projectId="p1" members={[]} teamMembers={[]} {...deliverProps} />,
    { wrapper: Wrapper },
  );
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

// ── Flujo de entrega: tarea sin subtareas, padre con subtareas, subtareas ──
//
// Reglas ejercitadas (ver `isDeliverableReady` / `isSubtaskReadyToComplete`
// en `utils/team-tasks.ts`):
//   1. Una tarea PADRE solo ofrece Entregar/Sin adjunto cuando su avance llegó
//      a 100% (todas sus subtareas COMPLETADAS) — mientras quede una abierta,
//      no hay botón de entrega aunque el responsable pueda entregarla.
//   2. Una SUBTAREA nunca ofrece Entregar/Sin adjunto: solo "Comenzar" (si no
//      ha arrancado) y luego "Marcar como realizada" (si ya está en curso).
//   3. Un bloqueo real del servidor (`delivery_blocked_reason`) se enseña como
//      "Bloqueada" en vez del botón, tanto en padres como en subtareas.
describe("TeamTasksView — entrega de tareas y subtareas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useDeleteTask).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
    vi.mocked(useUpdateTask).mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
    vi.mocked(useChangeTaskStatus).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as never);
  });

  it("una tarea padre con una subtarea abierta no ofrece Entregar todavía", async () => {
    const user = userEvent.setup();
    renderView(
      false,
      [
        // Avance real: 50% (una subtarea completada, otra pendiente) — el
        // backend ya hizo el promedio, la vista solo lo lee.
        task({ id: "parent", title: "Tarea padre", progress_pct: 50 }),
        task({
          id: "done",
          title: "Subtarea hecha",
          parent_task_id: "parent",
          status: "completada",
        }),
        task({
          id: "open",
          title: "Subtarea abierta",
          parent_task_id: "parent",
          status: "en_progreso",
        }),
      ],
      { onDeliver: vi.fn(), onMarkDelivered: vi.fn(), canDeliverTask: () => true },
    );

    await user.click(await screen.findByRole("button", { name: /Ver subtareas/i }));
    expect(screen.queryByRole("button", { name: /^Entregar$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Sin adjunto/i })).toBeNull();
  });

  it("una tarea padre al 100% ofrece Entregar y Sin adjunto", async () => {
    const user = userEvent.setup();
    const onDeliver = vi.fn();
    const onMarkDelivered = vi.fn();
    renderView(
      false,
      [task({ id: "parent", title: "Tarea padre", status: "en_progreso", progress_pct: 100 })],
      { onDeliver, onMarkDelivered, canDeliverTask: () => true },
    );

    await user.click(screen.getByRole("button", { name: /^Entregar$/i }));
    expect(onDeliver).toHaveBeenCalledWith(expect.objectContaining({ id: "parent" }));
    await user.click(screen.getByRole("button", { name: /Sin adjunto/i }));
    expect(onMarkDelivered).toHaveBeenCalledWith(expect.objectContaining({ id: "parent" }));
  });

  it("una subtarea en progreso ofrece 'Marcar como realizada' y no 'Entregar'", async () => {
    const user = userEvent.setup();
    const onMarkDelivered = vi.fn();
    renderView(
      false,
      [
        task({ id: "parent", title: "Tarea padre", progress_pct: 50 }),
        task({
          id: "child",
          title: "Subtarea",
          parent_task_id: "parent",
          status: "en_progreso",
        }),
      ],
      { onDeliver: vi.fn(), onMarkDelivered, canDeliverTask: () => true },
    );

    await user.click(await screen.findByRole("button", { name: /Ver subtareas/i }));
    expect(screen.queryByRole("button", { name: /^Entregar$/i })).toBeNull();
    await user.click(screen.getByRole("button", { name: /Marcar como realizada/i }));
    expect(onMarkDelivered).toHaveBeenCalledWith(expect.objectContaining({ id: "child" }));
  });

  it("una subtarea sin iniciar ofrece Comenzar, no Marcar como realizada", async () => {
    const user = userEvent.setup();
    renderView(
      false,
      [
        task({ id: "parent", title: "Tarea padre", progress_pct: 0 }),
        task({
          id: "child",
          title: "Subtarea",
          parent_task_id: "parent",
          status: "pendiente_por_iniciar",
        }),
      ],
      { onDeliver: vi.fn(), onMarkDelivered: vi.fn(), canDeliverTask: () => true },
    );

    await user.click(await screen.findByRole("button", { name: /Ver subtareas/i }));
    expect(await screen.findByRole("button", { name: /Comenzar/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Marcar como realizada/i })).toBeNull();
  });

  it("una subtarea bloqueada por una dependencia muestra 'Bloqueada' en vez del botón", async () => {
    const user = userEvent.setup();
    renderView(
      false,
      [
        task({ id: "parent", title: "Tarea padre", progress_pct: 0 }),
        task({
          id: "child",
          title: "Subtarea",
          parent_task_id: "parent",
          status: "en_progreso",
          delivery_blocked_reason: "Falta completar una subtarea hermana",
        }),
      ],
      { onDeliver: vi.fn(), onMarkDelivered: vi.fn(), canDeliverTask: () => true },
    );

    await user.click(await screen.findByRole("button", { name: /Ver subtareas/i }));
    expect(screen.getByText("Bloqueada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Marcar como realizada/i })).toBeNull();
  });

  it("sin canDeliverTask (no es mi entregable) no ofrece ningún botón de entrega", () => {
    renderView(false, [task({ id: "parent", title: "Tarea padre", progress_pct: 100 })], {
      onDeliver: vi.fn(),
      onMarkDelivered: vi.fn(),
      canDeliverTask: () => false,
    });

    expect(screen.queryByRole("button", { name: /^Entregar$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Sin adjunto/i })).toBeNull();
  });
});
