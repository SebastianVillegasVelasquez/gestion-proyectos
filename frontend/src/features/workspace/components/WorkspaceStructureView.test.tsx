import type { ReactElement } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { WorkspaceStructureView } from "./WorkspaceStructureView";
import type { ApiTeamMember, ApiTeamTask } from "../api/workspace.api";
import type { WorkItemTree } from "@/features/projects/types/api.types";

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
    progress_pct: 0,
    blocked_by: [],
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
});
