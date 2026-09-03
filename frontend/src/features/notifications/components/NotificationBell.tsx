import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Maximize2,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { resolveNotificationTarget } from "../utils/notification-target";
import {
  useDeleteNotification,
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from "../hooks/use-notifications";
import {
  formatBadgeCount,
  formatRelativeTime,
  notificationTypeLabel,
} from "../utils/notifications";
import { DEFAULT_TONE, FALLBACK_ICON, TYPE_ICON, TYPE_TONE } from "../utils/notification-visuals";
import type { AppNotification } from "../types";

function NotificationRow({
  notification,
  onRead,
  onDelete,
  onActivate,
  hasTarget,
}: {
  notification: AppNotification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  onActivate: (notification: AppNotification) => void;
  hasTarget: boolean;
}) {
  const Icon = TYPE_ICON[notification.notification_type] ?? FALLBACK_ICON;
  const tone = TYPE_TONE[notification.notification_type] ?? DEFAULT_TONE;
  const unread = !notification.is_read;
  return (
    <li className="group/item relative">
      <button
        type="button"
        onClick={() => {
          onActivate(notification);
        }}
        className={cn(
          "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 pr-16 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60",
          unread && "bg-brand-teal/[0.06] dark:bg-brand-teal/10",
        )}
      >
        <span
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            tone,
          )}
        >
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-sm leading-snug text-slate-700 dark:text-slate-200",
              unread && "font-medium text-slate-900 dark:text-slate-50",
            )}
          >
            {notification.message}
          </span>
          <span className="mt-1 flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
            {notificationTypeLabel(notification.notification_type)} ·{" "}
            {formatRelativeTime(notification.created_at)}
            {hasTarget && (
              <span className="ml-1 inline-flex items-center gap-0.5 text-brand-teal opacity-0 transition-opacity group-hover/item:opacity-100">
                <ChevronRight className="size-3" />
                Ver
              </span>
            )}
          </span>
        </span>
      </button>
      {/* Punto "no leída": se oculta al hover para dar paso a los botones */}
      {unread && (
        <span
          className="pointer-events-none absolute right-3.5 top-1/2 size-2 -translate-y-1/2 rounded-full bg-brand-teal transition-opacity group-hover/item:opacity-0"
          aria-hidden
        />
      )}
      <span className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
        {unread && (
          <button
            type="button"
            aria-label="Marcar como leída"
            title="Marcar como leída"
            onClick={() => {
              onRead(notification.id);
            }}
            className="flex size-7 items-center justify-center rounded-full text-brand-teal opacity-0 transition-all hover:bg-brand-teal/10 focus-visible:opacity-100 group-hover/item:opacity-100"
          >
            <Check className="size-4" />
          </button>
        )}
        <button
          type="button"
          aria-label="Eliminar notificación"
          title="Eliminar"
          onClick={() => {
            onDelete(notification.id);
          }}
          className="flex size-7 items-center justify-center rounded-full text-slate-400 opacity-0 transition-all hover:bg-rose-500/10 hover:text-rose-500 focus-visible:opacity-100 group-hover/item:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      </span>
    </li>
  );
}

export function NotificationBell({ placement = "down" }: { placement?: "down" | "up" }) {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"todas" | "no_leidas">("todas");

  const unreadQuery = useUnreadCount(isAuthenticated);
  const listQuery = useNotifications(open && isAuthenticated);
  const markAll = useMarkAllRead();
  const markRead = useMarkRead();
  const deleteOne = useDeleteNotification();

  const openFullView = () => {
    setOpen(false);
    void navigate("/notificaciones");
  };

  // Clic en una notificación: la marca leída y, si su tipo + payload permiten
  // deducir un destino, navega ahí y cierra el panel.
  const activate = (notification: AppNotification) => {
    if (!notification.is_read) {
      markRead.mutate(notification.id);
    }
    const target = resolveNotificationTarget(notification, user?.role);
    if (target) {
      setOpen(false);
      void navigate(target);
    }
  };

  const unread = unreadQuery.data?.unread_count ?? 0;
  const badge = formatBadgeCount(unread);
  const items = listQuery.data?.items ?? [];
  const visible = tab === "todas" ? items : items.filter((n) => !n.is_read);
  const total = listQuery.data?.total ?? items.length;

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
              "absolute z-50 flex max-h-[28rem] w-96 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl animate-in fade-in-0 zoom-in-95 duration-150 dark:border-slate-700 dark:bg-slate-900",
              placement === "up"
                ? "bottom-full left-0 mb-2 slide-in-from-bottom-1"
                : "right-0 top-full mt-2 slide-in-from-top-1",
            )}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                Notificaciones
                {unread > 0 && (
                  <span className="rounded-full bg-brand-teal/10 px-1.5 py-px text-[10px] font-semibold tabular-nums text-brand-teal-dark dark:text-brand-teal">
                    {unread} nueva{unread !== 1 ? "s" : ""}
                  </span>
                )}
              </span>
              <button
                type="button"
                disabled={unread === 0 || markAll.isPending}
                onClick={() => {
                  markAll.mutate();
                }}
                className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-brand-teal transition hover:bg-brand-teal/10 hover:text-brand-teal-dark disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent dark:disabled:text-slate-600"
              >
                <CheckCheck className="size-3.5" /> Marcar todas
              </button>
            </div>

            {/* Pestañas: todas / solo no leídas */}
            <div className="flex shrink-0 gap-1 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
              {(
                [
                  { key: "todas", label: "Todas" },
                  { key: "no_leidas", label: unread > 0 ? `No leídas (${unread})` : "No leídas" },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setTab(t.key);
                  }}
                  aria-pressed={tab === t.key}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                    tab === t.key
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {listQuery.isLoading ? (
                <div className="flex flex-col gap-2 p-3">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
                    />
                  ))}
                </div>
              ) : listQuery.isError ? (
                <p className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                  Las notificaciones no están disponibles por ahora.
                </p>
              ) : visible.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  {tab === "no_leidas" ? (
                    <>
                      <CheckCircle2 className="size-7 text-emerald-400" />
                      <p className="text-sm text-slate-400 dark:text-slate-500">Estás al día.</p>
                    </>
                  ) : (
                    <>
                      <Bell className="size-7 text-slate-300 dark:text-slate-600" />
                      <p className="text-sm text-slate-400 dark:text-slate-500">
                        No tienes notificaciones.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <ul className="flex flex-col gap-0.5 p-1.5">
                  {visible.map((n) => (
                    <NotificationRow
                      key={n.id}
                      notification={n}
                      onRead={(id) => {
                        markRead.mutate(id);
                      }}
                      onDelete={(id) => {
                        deleteOne.mutate(id);
                      }}
                      onActivate={activate}
                      hasTarget={resolveNotificationTarget(n, user?.role) !== null}
                    />
                  ))}
                </ul>
              )}
            </div>

            <button
              type="button"
              onClick={openFullView}
              className="flex shrink-0 items-center justify-center gap-1.5 border-t border-slate-100 px-4 py-2.5 text-[12px] font-medium text-brand-teal transition-colors hover:bg-brand-teal/5 hover:text-brand-teal-dark dark:border-slate-800"
            >
              <Maximize2 className="size-3.5" />
              Ver todas
              {total > items.length && (
                <span className="text-slate-400 dark:text-slate-500">
                  · {items.length} de {total}
                </span>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
