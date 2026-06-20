import { useState } from "react";
import {
  AlertTriangle,
  AtSign,
  Bell,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  FolderKanban,
  type LucideIcon,
  MessageSquare,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from "../hooks/use-notifications";
import {
  NOTIFICATION_TYPE_LABELS,
  formatBadgeCount,
  formatRelativeTime,
} from "../utils/notifications";
import type { AppNotification, NotificationType } from "../types";

// Ícono por tipo (presentación). Partial a propósito: si el backend enviara un
// tipo nuevo aún no mapeado, caemos a la campana sin romper.
const TYPE_ICON: Partial<Record<NotificationType, LucideIcon>> = {
  tarea_asignada: ClipboardList,
  tarea_entregada: CheckCircle2,
  tarea_rechazada: Undo2,
  tarea_atrasada: AlertTriangle,
  proyecto_miembro_agregado: FolderKanban,
  proyecto_cerrado: FolderKanban,
  proyecto_iniciado: FolderKanban,
  proyecto_pausado: FolderKanban,
  proyecto_finalizado: FolderKanban,
  comentario_publicado: MessageSquare,
  comentario_respuesta: MessageSquare,
  mencion: AtSign,
};

function NotificationRow({
  notification,
  onRead,
}: {
  notification: AppNotification;
  onRead: (id: string) => void;
}) {
  const Icon = TYPE_ICON[notification.notification_type] ?? Bell;
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          if (!notification.is_read) {
            onRead(notification.id);
          }
        }}
        className={cn(
          "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60",
          !notification.is_read && "bg-accent",
        )}
      >
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-slate-700 dark:text-slate-200">
            {notification.message}
          </span>
          <span className="mt-0.5 block text-[11px] text-slate-400 dark:text-slate-500">
            {NOTIFICATION_TYPE_LABELS[notification.notification_type]} ·{" "}
            {formatRelativeTime(notification.created_at)}
          </span>
        </span>
        {!notification.is_read && (
          <span
            className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-teal"
            aria-label="No leída"
          />
        )}
      </button>
    </li>
  );
}

export function NotificationBell({ placement = "down" }: { placement?: "down" | "up" }) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);

  const unreadQuery = useUnreadCount(isAuthenticated);
  const listQuery = useNotifications(open && isAuthenticated);
  const markAll = useMarkAllRead();
  const markRead = useMarkRead();

  const unread = unreadQuery.data?.unread_count ?? 0;
  const badge = formatBadgeCount(unread);
  const items = listQuery.data?.items ?? [];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
        }}
        aria-label="Notificaciones"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
      >
        <Bell className="size-4" />
        {badge && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop para cerrar al hacer clic afuera */}
          <button
            type="button"
            aria-label="Cerrar notificaciones"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => {
              setOpen(false);
            }}
          />
          <div
            role="dialog"
            aria-label="Notificaciones"
            className={cn(
              "absolute z-50 flex max-h-96 w-80 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900",
              placement === "up" ? "bottom-full left-0 mb-2" : "right-0 top-full mt-2",
            )}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Notificaciones
              </span>
              <button
                type="button"
                disabled={unread === 0 || markAll.isPending}
                onClick={() => {
                  markAll.mutate();
                }}
                className="flex items-center gap-1 text-xs font-medium text-brand-teal transition hover:text-brand-teal-dark disabled:cursor-not-allowed disabled:text-slate-300 dark:disabled:text-slate-600"
              >
                <CheckCheck className="size-3.5" /> Marcar todas
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {listQuery.isLoading ? (
                <div className="flex flex-col gap-2 p-3">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-12 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
                    />
                  ))}
                </div>
              ) : listQuery.isError ? (
                <p className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                  Las notificaciones no están disponibles por ahora.
                </p>
              ) : items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                  No tienes notificaciones.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((n) => (
                    <NotificationRow
                      key={n.id}
                      notification={n}
                      onRead={(id) => {
                        markRead.mutate(id);
                      }}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
