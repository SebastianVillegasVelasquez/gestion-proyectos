import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DeliverableDetailView } from "./DeliverableDetailView";
import type { Deliverable, WorkspaceMember } from "../types";

const members: WorkspaceMember[] = [
  { id: "u1", name: "Ana Ruiz", initials: "AR", avatarColor: "bg-brand-teal", role: "integrante" },
];

function deliverableWithVersion(): Deliverable {
  return {
    id: "d1",
    taskTitle: "Prototipo Módulo 1",
    assigneeId: "u1",
    taskId: null,
    status: "en_revision",
    versions: [
      {
        id: "v1",
        versionNumber: 1,
        type: "enlace",
        url: "https://old.example/v1",
        uploadedBy: "u1",
        uploadedAt: "2026-08-20T10:00:00Z",
        note: "Primera entrega",
        observations: "",
      },
    ],
    comments: [],
    createdAt: "2026-08-20T10:00:00Z",
    updatedAt: "2026-08-20T10:00:00Z",
  };
}

const base = {
  members,
  currentUserId: "u1",
  onAddVersion: vi.fn(),
  onReview: vi.fn(),
};

describe("DeliverableDetailView — editar una entrega ya subida", () => {
  it("no ofrece 'Editar' cuando no se puede entregar", () => {
    render(
      <DeliverableDetailView
        {...base}
        deliverable={deliverableWithVersion()}
        canDeliver={false}
        onEditVersion={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /editar/i })).toBeNull();
  });

  it("corrige la URL de una versión y llama a onEditVersion con el parche", async () => {
    const onEditVersion = vi.fn();
    render(
      <DeliverableDetailView
        {...base}
        deliverable={deliverableWithVersion()}
        canDeliver
        onEditVersion={onEditVersion}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /editar/i }));

    const url = screen.getByDisplayValue("https://old.example/v1");
    await userEvent.clear(url);
    await userEvent.type(url, "https://new.example/fixed");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(onEditVersion).toHaveBeenCalledWith(
      "v1",
      expect.objectContaining({ url: "https://new.example/fixed", type: "enlace" }),
    );
  });
});

describe("DeliverableDetailView — solo quien entregó toca su entregable", () => {
  it("no ofrece registrar ni editar el entregable de otra persona", () => {
    render(
      <DeliverableDetailView
        {...base}
        currentUserId="u2"
        deliverable={deliverableWithVersion()}
        canDeliver
        onEditVersion={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /registrar nueva entrega/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /editar/i })).toBeNull();
  });

  it("el dueño sí puede registrar una nueva entrega", () => {
    render(
      <DeliverableDetailView
        {...base}
        currentUserId="u1"
        deliverable={deliverableWithVersion()}
        canDeliver
      />,
    );
    expect(screen.getByRole("button", { name: /registrar nueva entrega/i })).toBeTruthy();
  });
});

describe("DeliverableDetailView — eliminar", () => {
  it("no ofrece eliminar el entregable de otra persona", () => {
    render(
      <DeliverableDetailView
        {...base}
        currentUserId="u2"
        deliverable={deliverableWithVersion()}
        canDeliver
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("Eliminar entregable")).toBeNull();
  });

  it("no ofrece eliminar un entregable ya aprobado, ni siquiera al dueño", () => {
    render(
      <DeliverableDetailView
        {...base}
        currentUserId="u1"
        deliverable={{ ...deliverableWithVersion(), status: "aprobado" }}
        canDeliver
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("Eliminar entregable")).toBeNull();
  });

  it("el dueño elimina su entregable tras confirmar", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <DeliverableDetailView
        {...base}
        currentUserId="u1"
        deliverable={deliverableWithVersion()}
        canDeliver
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByLabelText("Eliminar entregable"));
    expect(onDelete).not.toHaveBeenCalled();

    const dialog = screen.getByRole("dialog", { name: /Eliminar entregable/i });
    await user.click(within(dialog).getByRole("button", { name: /^Eliminar$/ }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

describe("DeliverableDetailView — acciones de revisión", () => {
  it("ofrece aprobar/rechazar/solicitar cambios al revisor mientras está en revisión", () => {
    render(
      <DeliverableDetailView
        {...base}
        deliverable={deliverableWithVersion()}
        canDeliver={false}
        canReview
      />,
    );
    expect(screen.getByRole("button", { name: /^Aprobar$/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Rechazar$/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /solicitar cambios/i })).toBeTruthy();
  });

  it("NO ofrece decisiones sobre un entregable ya aprobado (p. ej. tarea sin aprobación obligatoria)", () => {
    render(
      <DeliverableDetailView
        {...base}
        deliverable={{ ...deliverableWithVersion(), status: "aprobado" }}
        canDeliver={false}
        canReview
      />,
    );
    expect(screen.queryByRole("button", { name: /^Aprobar$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Rechazar$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /solicitar cambios/i })).toBeNull();
    expect(screen.getByText(/ya está aprobado/i)).toBeTruthy();
  });
});
