import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { notificationsApi } from "../api/notifications.api";
import type { PaginatedNotifications, UnreadCount } from "../types";

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

/**
 * Lista paginada para la vista completa `/notificaciones`. El backend solo
 * pagina y filtra por leídas/no leídas; el resto de filtros (tipo, prioridad,
 * texto, rango de fechas) se aplican en cliente sobre esta ventana, que crece
 * con el botón "Cargar más".
 */
export function useNotificationsList(pageSize: number) {
  return useQuery({
    queryKey: [...notificationKeys.list(), pageSize],
    queryFn: () => notificationsApi.list({ page: 1, pageSize }),
    retry: false,
    staleTime: 15_000,
  });
}

// Snapshot del cache antes de una mutación optimista, para poder revertir
// si el servidor falla (patrón "optimistic update" de React Query).
interface CacheSnapshot {
  list: PaginatedNotifications | undefined;
  unread: UnreadCount | undefined;
}

function snapshot(qc: QueryClient): CacheSnapshot {
  return {
    list: qc.getQueryData<PaginatedNotifications>(notificationKeys.list()),
    unread: qc.getQueryData<UnreadCount>(notificationKeys.unread()),
  };
}

function restore(qc: QueryClient, snap: CacheSnapshot | undefined) {
  if (!snap) {
    return;
  }
  qc.setQueryData(notificationKeys.list(), snap.list);
  qc.setQueryData(notificationKeys.unread(), snap.unread);
}

/**
 * Marca todas como leídas con actualización optimista: el cache se modifica
 * al instante (UI inmediata) y solo se revierte si el servidor responde error.
 */
export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.markAllAsRead,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: notificationKeys.all });
      const snap = snapshot(qc);
      qc.setQueryData<PaginatedNotifications>(
        notificationKeys.list(),
        (old) =>
          old && {
            ...old,
            unread_count: 0,
            items: old.items.map((n) =>
              n.is_read ? n : { ...n, is_read: true, read_at: new Date().toISOString() },
            ),
          },
      );
      qc.setQueryData<UnreadCount>(notificationKeys.unread(), { unread_count: 0 });
      return snap;
    },
    onError: (_err, _vars, snap) => {
      restore(qc, snap);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

/** Marca una notificación como leída, también de forma optimista. */
export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: notificationKeys.all });
      const snap = snapshot(qc);
      const wasUnread = snap.list?.items.some((n) => n.id === id && !n.is_read) ?? true;
      qc.setQueryData<PaginatedNotifications>(
        notificationKeys.list(),
        (old) =>
          old && {
            ...old,
            unread_count: wasUnread ? Math.max(0, old.unread_count - 1) : old.unread_count,
            items: old.items.map((n) =>
              n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n,
            ),
          },
      );
      if (wasUnread) {
        qc.setQueryData<UnreadCount>(
          notificationKeys.unread(),
          (old) => old && { unread_count: Math.max(0, old.unread_count - 1) },
        );
      }
      return snap;
    },
    onError: (_err, _id, snap) => {
      restore(qc, snap);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

/**
 * Borra una notificación de forma optimista: desaparece de todas las listas en
 * caché (panel y vista completa) al instante y, si estaba sin leer, baja el
 * contador. Se revierte si el servidor falla.
 */
export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.remove(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: notificationKeys.all });
      const lists = qc.getQueriesData<PaginatedNotifications>({
        queryKey: notificationKeys.list(),
      });
      const unread = qc.getQueryData<UnreadCount>(notificationKeys.unread());
      const wasUnread = lists.some(([, data]) =>
        data?.items.some((n) => n.id === id && !n.is_read),
      );
      for (const [key, data] of lists) {
        if (!data) {
          continue;
        }
        qc.setQueryData<PaginatedNotifications>(key, {
          ...data,
          items: data.items.filter((n) => n.id !== id),
          total: Math.max(0, data.total - 1),
          unread_count: wasUnread ? Math.max(0, data.unread_count - 1) : data.unread_count,
        });
      }
      if (wasUnread) {
        qc.setQueryData<UnreadCount>(
          notificationKeys.unread(),
          (old) => old && { unread_count: Math.max(0, old.unread_count - 1) },
        );
      }
      return { lists, unread };
    },
    onError: (_err, _id, ctx) => {
      ctx?.lists.forEach(([key, data]) => {
        qc.setQueryData(key, data);
      });
      if (ctx?.unread) {
        qc.setQueryData(notificationKeys.unread(), ctx.unread);
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}
