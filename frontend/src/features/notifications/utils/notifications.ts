import type { NotificationType } from "../types";

// Etiqueta legible por tipo de notificación (para accesibilidad/agrupar).
// `Partial`: si el backend estrena un tipo antes que el frontend, el acceso
// devuelve undefined en vez de fallar el tipado — y `notificationTypeLabel`
// cae al valor crudo. Nunca desreferenciar este mapa directo: usar el helper.
export const NOTIFICATION_TYPE_LABELS: Partial<Record<NotificationType, string>> = {
  tarea_asignada: "Tarea asignada",
  subtarea_asignada: "Subtarea asignada",
  tarea_iniciada: "Tarea iniciada",
  tarea_entregada: "Tarea entregada",
  tarea_rechazada: "Tarea devuelta",
  tarea_atrasada: "Tarea atrasada",
  tarea_por_vencer: "Tarea por vencer",
  tarea_completada: "Tarea aprobada",
  tarea_devuelta: "Entrega con observaciones",
  tarea_reprogramada: "Tarea reprogramada",
  dependencia_terceros_fechada: "Actividad de terceros con fecha",
  proyecto_miembro_agregado: "Agregado a un proyecto",
  proyecto_cerrado: "Proyecto cerrado",
  proyecto_iniciado: "Proyecto iniciado",
  proyecto_pausado: "Proyecto pausado",
  proyecto_finalizado: "Proyecto finalizado",
  comentario_publicado: "Nuevo comentario",
  comentario_respuesta: "Respuesta a tu comentario",
  mencion: "Te mencionaron",
  recordatorio: "Recordatorio",
};

/** Etiqueta legible de un tipo, resistente a tipos que el backend estrene y
 *  aquí aún no estén mapeados: cae al valor crudo (que ya es un string) en vez
 *  de romper. El `?? type` es lo que evita el "undefined.localeCompare(...)". */
export function notificationTypeLabel(type: NotificationType): string {
  return NOTIFICATION_TYPE_LABELS[type] ?? type;
}

// Las notificaciones no traen "prioridad" del backend; se deriva del tipo para
// poder filtrarlas y ordenarlas en la vista completa. alta = necesita acción
// (atrasos, devoluciones, menciones), media = te involucra, baja = informativo.
export type NotificationPriority = "alta" | "media" | "baja";

const PRIORITY_BY_TYPE: Partial<Record<NotificationType, NotificationPriority>> = {
  tarea_asignada: "media",
  subtarea_asignada: "media",
  tarea_iniciada: "baja",
  tarea_entregada: "media",
  tarea_rechazada: "alta",
  tarea_atrasada: "alta",
  tarea_por_vencer: "alta",
  tarea_completada: "media",
  tarea_devuelta: "alta",
  tarea_reprogramada: "media",
  dependencia_terceros_fechada: "media",
  proyecto_miembro_agregado: "media",
  proyecto_cerrado: "baja",
  proyecto_iniciado: "baja",
  proyecto_pausado: "baja",
  proyecto_finalizado: "baja",
  comentario_publicado: "media",
  comentario_respuesta: "media",
  mencion: "alta",
  recordatorio: "media",
};

export function notificationPriority(type: NotificationType): NotificationPriority {
  return PRIORITY_BY_TYPE[type] ?? "media";
}

export const NOTIFICATION_PRIORITY_LABELS: Record<NotificationPriority, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
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
