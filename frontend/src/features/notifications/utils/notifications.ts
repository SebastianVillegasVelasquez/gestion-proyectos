import type { NotificationType } from "../types";

// Etiqueta legible por tipo de notificación (para accesibilidad/agrupar).
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  tarea_asignada: "Tarea asignada",
  tarea_entregada: "Tarea entregada",
  tarea_rechazada: "Tarea devuelta",
  tarea_atrasada: "Tarea atrasada",
  tarea_completada: "Tarea aprobada",
  tarea_devuelta: "Entrega con observaciones",
  proyecto_miembro_agregado: "Agregado a un proyecto",
  proyecto_cerrado: "Proyecto cerrado",
  proyecto_iniciado: "Proyecto iniciado",
  proyecto_pausado: "Proyecto pausado",
  proyecto_finalizado: "Proyecto finalizado",
  comentario_publicado: "Nuevo comentario",
  comentario_respuesta: "Respuesta a tu comentario",
  mencion: "Te mencionaron",
};

/** Texto del badge: acota a "9+" para no romper el círculo. */
export function formatBadgeCount(count: number): string {
  if (count <= 0) {
    return "";
  }
  return count > 9 ? "9+" : String(count);
}

/**
 * Tiempo relativo corto en español ("hace 5 min", "hace 2 h", "hace 3 d").
 * `now` es inyectable para poder testearlo de forma determinista.
 */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return "";
  }
  const diffSec = Math.max(0, Math.round((now - then) / 1000));
  if (diffSec < 60) {
    return "ahora";
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `hace ${diffMin} min`;
  }
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) {
    return `hace ${diffHour} h`;
  }
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) {
    return `hace ${diffDay} d`;
  }
  const diffWeek = Math.floor(diffDay / 7);
  return `hace ${diffWeek} sem`;
}
