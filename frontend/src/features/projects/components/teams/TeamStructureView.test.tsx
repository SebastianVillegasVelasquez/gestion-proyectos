import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TeamStructureView, type StructureTask } from "./TeamStructureView";
import type { WorkItemTree } from "../../types/api.types";

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

const tree = [node("u1", "Unidad 1")];
const tasks: StructureTask[] = [
  {
    id: "a",
    title: "Guion",
    status: "en_progreso",
    start_date: null,
    due_date: null,
    work_item_id: "u1",
  },
  {
    id: "b",
    title: "Montaje",
    status: "en_progreso",
    start_date: null,
    due_date: null,
    work_item_id: "u1",
  },
];

const common = {
  tree,
  tasks,
  resolveWho: () => "Ana",
  today: "2026-08-28",
};

describe("TeamStructureView — atajo Entregar (fase 3.4)", () => {
  it("no muestra el botón Entregar si no se pasa onDeliverTask", () => {
    render(<TeamStructureView {...common} />);
    expect(screen.queryByRole("button", { name: /entregar/i })).toBeNull();
  });

  it("muestra Entregar por tarea elegible y llama a onDeliverTask con la tarea", async () => {
    const onDeliverTask = vi.fn();
    render(
      <TeamStructureView {...common} onDeliverTask={onDeliverTask} canDeliverTask={() => true} />,
    );
    const buttons = screen.getAllByRole("button", { name: /entregar/i });
    expect(buttons).toHaveLength(2);
    await userEvent.click(buttons[0]);
    expect(onDeliverTask).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
  });

  it("oculta Entregar en las tareas que canDeliverTask descarta", () => {
    render(
      <TeamStructureView
        {...common}
        onDeliverTask={vi.fn()}
        canDeliverTask={(t) => t.id === "a"}
      />,
    );
    expect(screen.getAllByRole("button", { name: /entregar/i })).toHaveLength(1);
  });

  it("ofrece 'Sin adjunto' cuando se pasa onMarkDeliveredTask", async () => {
    const onMarkDeliveredTask = vi.fn();
    render(
      <TeamStructureView
        {...common}
        onMarkDeliveredTask={onMarkDeliveredTask}
        canDeliverTask={() => true}
      />,
    );
    const buttons = screen.getAllByRole("button", { name: /sin adjunto/i });
    expect(buttons).toHaveLength(2);
    await userEvent.click(buttons[1]);
    expect(onMarkDeliveredTask).toHaveBeenCalledWith(expect.objectContaining({ id: "b" }));
  });
});
