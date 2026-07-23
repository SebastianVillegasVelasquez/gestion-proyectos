// Espejo de NotificationType del backend.
export type NotificationType =
  | "tarea_asignada"
  | "tarea_entregada"
  | "tarea_rechazada"
  | "tarea_atrasada"
  | "tarea_completada"
  | "tarea_devuelta"
  | "proyecto_miembro_agregado"
  | "proyecto_cerrado"
  | "proyecto_iniciado"
  | "proyecto_pausado"
  | "proyecto_finalizado"
  | "comentario_publicado"
  | "comentario_respuesta"
  | "mencion";

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
