import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DeliverableList } from "./DeliverableList";
import type { Deliverable, WorkspaceMember } from "../types";

const members: WorkspaceMember[] = [
  { id: "u1", name: "Ana Ruiz", initials: "AR", avatarColor: "bg-brand-teal", role: "integrante" },
  { id: "u2", name: "Beto Sol", initials: "BS", avatarColor: "bg-brand-gold", role: "integrante" },
];

function d(over: Partial<Deliverable>): Deliverable {
  return {
    id: "d",
    taskTitle: "Prototipo",
    assigneeId: "u1",
    taskId: null,
    status: "en_revision",
    versions: [],
    comments: [],
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...over,
  };
}

describe("DeliverableList — filtro y paginación", () => {
  it("filtra la lista por texto", async () => {
    const list = [
      d({ id: "a", taskTitle: "Guion módulo 1" }),
      d({ id: "b", taskTitle: "Montaje final" }),
    ];
    render(
      <DeliverableList
        deliverables={list}
        members={members}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Guion módulo 1")).toBeInTheDocument();
    expect(screen.getByText("Montaje final")).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText(/buscar por título/i), "montaje");
    expect(screen.queryByText("Guion módulo 1")).toBeNull();
    expect(screen.getByText("Montaje final")).toBeInTheDocument();
  });

  it("pagina cuando hay más de 10 entregables y avanza con el pager", async () => {
    const list = Array.from({ length: 12 }, (_, i) =>
      d({ id: `d${String(i)}`, taskTitle: `Entregable ${String(i).padStart(2, "0")}` }),
    );
    render(
      <DeliverableList
        deliverables={list}
        members={members}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Entregable 00")).toBeInTheDocument();
    expect(screen.queryByText("Entregable 11")).toBeNull();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /página siguiente/i }));
    expect(screen.getByText("Entregable 11")).toBeInTheDocument();
    expect(screen.queryByText("Entregable 00")).toBeNull();
  });

  it("muestra un vacío distinto cuando el filtro no encuentra nada", async () => {
    render(
      <DeliverableList
        deliverables={[d({ id: "a", taskTitle: "Guion" })]}
        members={members}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    await userEvent.type(screen.getByPlaceholderText(/buscar por título/i), "zzz");
    expect(screen.getByText(/ningún entregable coincide/i)).toBeInTheDocument();
  });
});
