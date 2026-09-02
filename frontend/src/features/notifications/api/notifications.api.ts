import http from "@/lib/http";
import type {
  AppNotification,
  NotificationListParams,
  PaginatedNotifications,
  UnreadCount,
} from "../types";

// Cliente HTTP de notificaciones. Mapea 1:1 con los endpoints del backend
// (/api/v1/notifications). Solo traduce parámetros; sin lógica de negocio.
export const notificationsApi = {
  unreadCount: () => http.get<UnreadCount>("/notifications/unread-count").then((r) => r.data),

  list: ({ onlyUnread = false, page = 1, pageSize = 10 }: NotificationListParams = {}) =>
    http
      .get<PaginatedNotifications>("/notifications/", {
        params: { only_unread: onlyUnread, page, page_size: pageSize },
      })
      .then((r) => r.data),

  markAsRead: (id: string) =>
    http.patch<AppNotification>(`/notifications/${id}/read`).then((r) => r.data),

  markAllAsRead: () =>
    http.patch<{ updated: number }>("/notifications/read-all").then((r) => r.data),

  remove: (id: string) =>
    http.delete(`/notifications/${id}`).then(() => {
      /* 204 sin cuerpo */
    }),
};
