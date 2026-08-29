import { describe, expect, it } from "vitest";
import type { AppNotification } from "../types";
import { resolveNotificationTarget } from "./notification-target";

function notif(over: Partial<AppNotification> = {}): AppNotification {
  return {
    id: "n1",
    message: "x",
    user_to_id: "u1",
    actor_id: null,
    notification_type: "tarea_asignada",
    payload: null,
    read_at: null,
    is_read: false,
    created_at: "2026-06-18T11:00:00Z",
    ...over,
  };
}

describe("resolveNotificationTarget", () => {
  it("sends an admin to the project's task page with the task focused", () => {
    const target = resolveNotificationTarget(
      notif({ payload: { project_id: "p1", task_id: "t1" } }),
      "admin",
    );
    expect(target).toBe("/projects/p1/tareas?focus=t1");
  });

  it("sends a plain user to their workspace with the task focused", () => {
    const target = resolveNotificationTarget(
      notif({ payload: { project_id: "p1", task_id: "t1" } }),
      "user",
    );
    expect(target).toBe("/workspace?focus=t1");
  });

  it("routes 'added to a project' by role", () => {
    expect(
      resolveNotificationTarget(
        notif({ notification_type: "proyecto_miembro_agregado", payload: { project_id: "p1" } }),
        "admin",
      ),
    ).toBe("/projects/p1");
    expect(
      resolveNotificationTarget(
        notif({ notification_type: "proyecto_miembro_agregado", payload: { project_id: "p1" } }),
        "user",
      ),
    ).toBe("/proyectos/p1/progreso");
  });

  it("falls back to the workspace when there is no project id", () => {
    expect(resolveNotificationTarget(notif({ payload: null }), "admin")).toBe("/workspace");
  });

  it("routes conversation notifications to the workspace for a user", () => {
    expect(
      resolveNotificationTarget(
        notif({ notification_type: "comentario_respuesta", payload: null }),
        "user",
      ),
    ).toBe("/workspace");
  });
});
