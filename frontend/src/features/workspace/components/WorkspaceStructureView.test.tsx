import type { ReactElement } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { WorkspaceStructureView } from "./WorkspaceStructureView";
import type { ApiTeamMember, ApiTeamTask } from "../api/workspace.api";
import type { WorkItemTree } from "@/features/projects/types/api.types";

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u1", name: "Ana" } }),
}));

vi.mock("@/features/projects/hooks/use-tasks", () => ({
  useChangeTaskStatus: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateTask: () => ({ mutate: vi.fn(), isPending: false }),
}));

function node(id: string, nombre: string, children: WorkItemTree[] = []): WorkItemTree {
  return {
    id,
    proyecto_id: "p1",
    parent_id: null,
    tipo_id: "t1",
    nombre,
    orden: 0,
    prioridad: null,
    fecha_inicio_plan: null,
    fecha_fin_plan: null,
    duracion_valor: null,
    duracion_unidad: null,
    fecha_inicio_real: null,
    fecha_fin_real: null,
    porcentaje_completado: null,
    es_transversal: false,
    advertencia_fechas: false,
    children,
  } as WorkItemTree;
}

function task(over: Partial<ApiTeamTask>): ApiTeamTask {
  return {
    id: "x",
    title: "Tarea",
    status: "en_progreso",
    priority: "media",
    work_item_id: "u1",
    work_item_name: "Unidad 1",
    project_id: "p1",
    project_name: "Proyecto",
    assignee_id: null,
    assignee_name: null,
    parent_task_id: null,
    start_date: null,
    due_date: null,
    requires_approval: false,
    // Por defecto "lista para entregar" (tarea raíz al 100%): los tests que
    // ejercitan Entregar/Sin adjunto no tienen que repetirlo.
    progress_pct: 100,
    blocked_by: [],
    depends_on_third_party: false,
    delivery_blocked_reason: null,
    ...over,
  };
}

const tree = [node("u1", "Unidad 1")];
const typeNameById = new Map([["t1", "Módulo"]]);
const teamMembers: ApiTeamMember[] = [
  { user_id: "m1", name: "Ana", last_name: "Ruiz", position: "dev", team_role: "integrante" },
];

const base = {
  tree,
  typeNameById,
  today: "2026-08-28",
  projectId: "p1",
  teamMembers,
  onReassigned: vi.fn(),
};

function renderView(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("WorkspaceStructureView", () => {
  it("pinta el chip del tipo, el nombre del elemento y la tarea con su estado", () => {
    renderView(
      <WorkspaceStructureView
        {...base}
        canReview={false}
        tasks={[task({ id: "a", title: "Guion", status: "en_revision" })]}
      />,
    );
    expect(screen.getByText("Módulo")).toBeInTheDocument();
    expect(screen.getByText("Unidad 1")).toBeInTheDocument();
    expect(screen.getByText("Guion")).toBeInTheDocument();
    expect(screen.getByText("En revisión")).toBeInTheDocument();
    expect(screen.getByText("Sin responsable")).toBeInTheDocument();
  });

  it("para el líder ofrece reasignar cada tarea", () => {
    renderView(
      <WorkspaceStructureView {...base} canReview tasks={[task({ id: "a", title: "Guion" })]} />,
    );
    expect(screen.getByRole("button", { name: /reasignar responsable/i })).toBeInTheDocument();
  });

  it("agrupa las tareas sueltas bajo 'Fuera de la estructura'", () => {
    renderView(
      <WorkspaceStructureView
        {...base}
        canReview={false}
        tasks={[task({ id: "a", title: "Suelta", work_item_id: null, work_item_name: null })]}
      />,
    );
    expect(screen.getByText(/fuera de la estructura/i)).toBeInTheDocument();
    expect(screen.getByText("Suelta")).toBeInTheDocument();
  });

  it("ofrece 'Entregar' y 'Sin adjunto' según canDeliverTask", async () => {
    const onDeliverTask = vi.fn();
    renderView(
      <WorkspaceStructureView
        {...base}
        canReview={false}
        tasks={[task({ id: "a", title: "Guion" })]}
        onDeliverTask={onDeliverTask}
        canDeliverTask={() => true}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /entregar/i }));
    expect(onDeliverTask).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
  });

  it("una tarea con dependencia abierta se ve bloqueada, sin botón de entregar", () => {
    renderView(
      <WorkspaceStructureView
        {...base}
        canReview={false}
        tasks={[
          task({
            id: "a",
            title: "Guion",
            delivery_blocked_reason: "Una dependencia sigue abierta",
          }),
        ]}
        onDeliverTask={vi.fn()}
        onMarkDeliveredTask={vi.fn()}
        canDeliverTask={() => true}
      />,
    );
    expect(screen.getByText("Bloqueada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /entregar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sin adjunto/i })).not.toBeInTheDocument();
  });

  // ── Flujo de entrega: mismas reglas que en la vista Lista (TeamTasksView),
  //    aquí ejercitadas contra el árbol de la Estructura. Una tarea de nivel
  //    superior sin subtareas ya comenzada, o una subtarea ya comenzada,
  //    ofrecen "Entregar" y "Entregar sin adjunto"; una tarea padre con
  //    subtareas abiertas, ninguno de los dos hasta el 100%. ────────────────

  it("una tarea padre con subtareas sin terminar no ofrece Entregar (solo la subtarea lista lo ofrece)", () => {
    const onDeliverTask = vi.fn();
    renderView(
      <WorkspaceStructureView
        {...base}
        canReview={false}
        tasks={[
          task({ id: "parent", title: "Tarea padre", progress_pct: 50 }),
          task({
            id: "child",
            title: "Subtarea",
            parent_task_id: "parent",
            work_item_id: null,
            status: "en_progreso",
          }),
        ]}
        onDeliverTask={onDeliverTask}
        onMarkDeliveredTask={vi.fn()}
        canDeliverTask={() => true}
      />,
    );
    const entregarButtons = screen.getAllByRole("button", { name: /^entregar$/i });
    expect(entregarButtons).toHaveLength(1);
  });

  it("una subtarea sin iniciar ofrece Comenzar; ya en progreso, Entregar y Entregar sin adjunto", async () => {
    const user = userEvent.setup();
    const onDeliverTask = vi.fn();
    const onMarkDeliveredTask = vi.fn();
    const { rerender } = renderView(
      <WorkspaceStructureView
        {...base}
        canReview={false}
        tasks={[
          task({ id: "parent", title: "Tarea padre", progress_pct: 0 }),
          task({
            id: "child",
            title: "Subtarea",
            parent_task_id: "parent",
            status: "pendiente_por_iniciar",
            assignee_id: "u1",
            assignee_name: "Ana",
          }),
        ]}
        onDeliverTask={onDeliverTask}
        onMarkDeliveredTask={onMarkDeliveredTask}
        canDeliverTask={() => true}
      />,
    );

    // Sin iniciar: "Comenzar", nunca los botones de entrega.
    expect(await screen.findByRole("button", { name: /comenzar/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^entregar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /entregar sin adjunto/i })).not.toBeInTheDocument();

    // Ya en progreso: ambos botones de entrega.
    rerender(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <WorkspaceStructureView
          {...base}
          canReview={false}
          tasks={[
            task({ id: "parent", title: "Tarea padre", progress_pct: 0 }),
            task({
              id: "child",
              title: "Subtarea",
              parent_task_id: "parent",
              status: "en_progreso",
              assignee_id: "u1",
              assignee_name: "Ana",
            }),
          ]}
          onDeliverTask={onDeliverTask}
          onMarkDeliveredTask={onMarkDeliveredTask}
          canDeliverTask={() => true}
        />
      </QueryClientProvider>,
    );
    expect(screen.queryByRole("button", { name: /comenzar/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^entregar$/i }));
    expect(onDeliverTask).toHaveBeenCalledWith(expect.objectContaining({ id: "child" }));
    await user.click(screen.getByRole("button", { name: /entregar sin adjunto/i }));
    expect(onMarkDeliveredTask).toHaveBeenCalledWith(expect.objectContaining({ id: "child" }));
  });
});
