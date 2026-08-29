import { describe, it, expect } from "vitest";
import { buildTeamActivity } from "./team-activity";
import type { Deliverable, WorkspaceMember } from "../types";

const members: WorkspaceMember[] = [
  { id: "u1", name: "Ana Ruiz", initials: "AR", avatarColor: "bg-violet-600", role: "integrante" },
  { id: "u2", name: "Beto Paz", initials: "BP", avatarColor: "bg-blue-600", role: "lider" },
];

function deliverable(over: Partial<Deliverable> = {}): Deliverable {
  return {
    id: "d1",
    taskTitle: "Prototipo",
    assigneeId: "u1",
    taskId: null,
    status: "en_revision",
    versions: [],
    comments: [],
    createdAt: "2026-03-01T08:00:00Z",
    updatedAt: "2026-03-01T08:00:00Z",
    ...over,
  };
}

describe("buildTeamActivity", () => {
  it("convierte entregas y revisiones en hechos legibles, del más reciente al más antiguo", () => {
    const events = buildTeamActivity(
      [
        deliverable({
          versions: [
            {
              id: "v1",
              versionNumber: 1,
              type: "enlace",
              url: "https://x",
              uploadedBy: "u1",
              uploadedAt: "2026-03-01T10:00:00Z",
              note: "",
              observations: "",
            },
          ],
          comments: [
            {
              id: "c1",
              authorId: "u2",
              content: "Falta el estado vacío",
              createdAt: "2026-03-02T10:00:00Z",
              type: "solicitud_cambio",
              mentions: [],
            },
          ],
        }),
      ],
      members,
    );

    expect(events).toHaveLength(2);
    expect(events[0].text).toBe('Beto Paz solicitó cambios en "Prototipo"');
    expect(events[1].text).toBe('Ana Ruiz entregó la V1 de "Prototipo"');
  });

  it("distingue rechazo de solicitud de cambios y de aprobación", () => {
    const withComment = (type: "aprobacion" | "rechazo") =>
      buildTeamActivity(
        [
          deliverable({
            comments: [
              {
                id: "c",
                authorId: "u2",
                content: "…",
                createdAt: "2026-03-02T10:00:00Z",
                type,
                mentions: [],
              },
            ],
          }),
        ],
        members,
      )[0];

    expect(withComment("aprobacion").text).toContain("aprobó");
    expect(withComment("rechazo").text).toContain("rechazó");
    expect(withComment("rechazo").dot).toContain("rose");
  });

  it("no rompe cuando el autor ya no está en el equipo", () => {
    const events = buildTeamActivity(
      [
        deliverable({
          comments: [
            {
              id: "c",
              authorId: "fantasma",
              content: "…",
              createdAt: "2026-03-02T10:00:00Z",
              type: "comentario",
              mentions: [],
            },
          ],
        }),
      ],
      members,
    );
    expect(events[0].text).toContain("Alguien");
  });

  it("corta el feed al límite pedido", () => {
    const many = deliverable({
      comments: Array.from({ length: 20 }, (_, i) => ({
        id: `c${String(i)}`,
        authorId: "u1",
        content: "…",
        createdAt: `2026-03-${String(i + 1).padStart(2, "0")}T10:00:00Z`,
        type: "comentario" as const,
        mentions: [],
      })),
    });
    expect(buildTeamActivity([many], members, 5)).toHaveLength(5);
  });
});
