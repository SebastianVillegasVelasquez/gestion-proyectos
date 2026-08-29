import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
