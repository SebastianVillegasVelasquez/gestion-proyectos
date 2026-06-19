import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "../api/notifications.api";

export const notificationKeys = {
  all: ["notifications"] as const,
  unread: () => [...notificationKeys.all, "unread"] as const,
  list: () => [...notificationKeys.all, "list"] as const,
};

// Refresco del contador en segundo plano (60 s). Suave: no reintenta ante
// errores para no spamear si el backend de notificaciones aún no responde.
const POLL_MS = 60_000;

/** Contador de no leídas para el badge. Solo activo con sesión iniciada. */
export function useUnreadCount(enabled: boolean) {
  return useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: notificationsApi.unreadCount,
    enabled,
    retry: false,
    staleTime: 30_000,
    refetchInterval: enabled ? POLL_MS : false,
    refetchIntervalInBackground: false,
  });
}

/** Lista de notificaciones (se pide al abrir el panel). */
export function useNotifications(enabled: boolean) {
  return useQuery({
    queryKey: notificationKeys.list(),
    queryFn: () => notificationsApi.list(),
    enabled,
    retry: false,
    staleTime: 15_000,
  });
}

function useInvalidateNotifications() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: notificationKeys.all });
}

export function useMarkAllRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: notificationsApi.markAllAsRead,
    onSuccess: invalidate,
  });
}

export function useMarkRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: invalidate,
  });
}
