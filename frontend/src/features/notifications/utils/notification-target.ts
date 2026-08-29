import { Role } from "@/features/auth/types";
import type { AppNotification } from "../types";

const ADMIN_ROLES: readonly Role[] = [Role.ADMIN, Role.SUPER_ADMIN, Role.DEVELOPER];

function pick(payload: Record<string, unknown> | null, key: string): string | null {
  const value = payload?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Ruta interna a la que llevar al usuario cuando hace clic en una notificación.
 * Devuelve `null` si no hay un destino claro (la fila entonces solo marca leído).
 *
 * El destino depende del rol: un `user` no tiene acceso a `/projects/:id/*`
 * (rutas de admin), así que se le manda a su espacio de trabajo o a
 * "mis proyectos". El id de la tarea viaja como `?focus=` para que la vista
 * destino pueda resaltarla o abrir su detalle.
 */
export function resolveNotificationTarget(
  notification: AppNotification,
  role: Role | undefined,
): string | null {
  const isAdmin = role !== undefined && ADMIN_ROLES.includes(role);
  const projectId = pick(notification.payload, "project_id");
  const taskId = pick(notification.payload, "task_id");
  const focus = taskId ? `?focus=${taskId}` : "";

  switch (notification.notification_type) {
    case "tarea_asignada":
    case "tarea_entregada":
    case "tarea_atrasada":
    case "tarea_completada":
    case "tarea_devuelta":
    case "tarea_rechazada":
    case "comentario_publicado":
    case "comentario_respuesta":
    case "mencion": {
      if (isAdmin && projectId) {
        return `/projects/${projectId}/tareas${focus}`;
      }
      return `/workspace${focus}`;
    }

    case "proyecto_miembro_agregado":
    case "proyecto_iniciado":
    case "proyecto_pausado":
    case "proyecto_cerrado":
    case "proyecto_finalizado": {
      if (isAdmin && projectId) {
        return `/projects/${projectId}`;
      }
      if (projectId) {
        return `/proyectos/${projectId}/progreso`;
      }
      return "/mis-proyectos";
    }

    default:
      return null;
  }
}
