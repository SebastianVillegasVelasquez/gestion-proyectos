import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { TeamProgressView } from "./TeamProgressView";
import type { ApiTeamMember, ApiTeamTask } from "../api/workspace.api";

function task(over: Partial<ApiTeamTask>): ApiTeamTask {
  return {
    id: "t",
    title: "Tarea",
    status: "en_progreso",
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
    blocked_by: [],
    ...over,
  };
}

const members: ApiTeamMember[] = [
  {
    user_id: "u1",
    name: "Ana",
    last_name: "Ruiz",
    position: "desarrollador",
    team_role: "integrante",
  },
];

describe("TeamProgressView", () => {
  it("muestra el vacío cuando no hay tareas", () => {
    render(
      <TeamProgressView tasks={[]} deliverables={[]} teamMembers={members} today="2026-08-28" />,
    );
    expect(screen.getByText(/aún no hay nada que medir/i)).toBeInTheDocument();
  });

  it("pinta el % de avance y la carga por integrante", () => {
    const tasks = [
      task({ id: "a", status: "completada" }),
      task({ id: "b", status: "en_progreso" }),
    ];
    render(
      <TeamProgressView tasks={tasks} deliverables={[]} teamMembers={members} today="2026-08-28" />,
    );
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText(/carga por integrante/i)).toBeInTheDocument();
    expect(screen.getByText("Ana Ruiz")).toBeInTheDocument();
  });
});
