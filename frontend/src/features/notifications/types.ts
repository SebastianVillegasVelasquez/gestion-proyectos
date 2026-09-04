// Espejo de NotificationType del backend
// (backend/src/app/modules/notifications/infrastructure/enums.py). Mantener en
// sincronía: un tipo que el backend envíe y aquí falte NO debe romper la UI
// (ver `notificationTypeLabel` / `notificationPriority`, que caen a un valor
// por defecto), pero sí sale sin etiqueta bonita.
export type NotificationType =
  | "tarea_asignada"
  | "subtarea_asignada"
  | "tarea_iniciada"
  | "tarea_entregada"
  | "tarea_rechazada"
  | "tarea_atrasada"
  | "tarea_por_vencer"
  | "tarea_completada"
  | "tarea_devuelta"
  | "tarea_reprogramada"
  | "dependencia_terceros_fechada"
  | "proyecto_miembro_agregado"
  | "proyecto_cerrado"
  | "proyecto_iniciado"
  | "proyecto_pausado"
  | "proyecto_finalizado"
  | "comentario_publicado"
  | "comentario_respuesta"
  | "mencion"
  | "recordatorio";

export interface AppNotification {
  id: string;
  message: string;
  user_to_id: string;
  actor_id: string | null;
  notification_type: NotificationType;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  is_read: boolean;
  created_at: string;
}

export interface PaginatedNotifications {
  items: AppNotification[];
  total: number;
  unread_count: number;
  page: number;
  page_size: number;
}

export interface UnreadCount {
  unread_count: number;
}

export interface NotificationListParams {
  onlyUnread?: boolean;
  page?: number;
  pageSize?: number;
}
