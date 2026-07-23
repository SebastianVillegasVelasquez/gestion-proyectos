import { useState } from "react";
import {
  AlertTriangle,
  AtSign,
  Bell,
  Check,
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
  tarea_completada: CheckCircle2,
  tarea_devuelta: Undo2,
  proyecto_miembro_agregado: FolderKanban,
  proyecto_cerrado: FolderKanban,
  proyecto_iniciado: FolderKanban,
  proyecto_pausado: FolderKanban,
  proyecto_finalizado: FolderKanban,
  comentario_publicado: MessageSquare,
  comentario_respuesta: MessageSquare,
  mencion: AtSign,
};

// Tono del ícono por familia de evento: tareas → teal/rose, proyectos →
// violeta, conversación → azul/ámbar. Ayuda a escanear el panel de un vistazo.
const TYPE_TONE: Partial<Record<NotificationType, string>> = {
  tarea_asignada:
    "bg-brand-teal-light text-brand-teal-dark dark:bg-brand-teal/15 dark:text-brand-teal",
  tarea_entregada: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300",
  tarea_rechazada: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300",
  tarea_atrasada: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300",
  tarea_completada: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300",
  tarea_devuelta: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300",
  proyecto_miembro_agregado:
    "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300",
  proyecto_cerrado: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300",
  proyecto_iniciado: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300",
  proyecto_pausado: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300",
  proyecto_finalizado: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300",
  comentario_publicado: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300",
  comentario_respuesta: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300",
  mencion: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300",
};

const DEFAULT_TONE = "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300";

function NotificationRow({
  notification,
  onRead,
}: {
  notification: AppNotification;
  onRead: (id: string) => void;
}) {
  const Icon = TYPE_ICON[notification.notification_type] ?? Bell;
  const tone = TYPE_TONE[notification.notification_type] ?? DEFAULT_TONE;
  const unread = !notification.is_read;
  return (
    <li className="group/item relative">
      <button
        type="button"
        onClick={() => {
          if (unread) {
            onRead(notification.id);
          }
        }}
        className={cn(
          "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 pr-10 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60",
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
          <span className="mt-1 block text-[11px] text-slate-400 dark:text-slate-500">
            {NOTIFICATION_TYPE_LABELS[notification.notification_type]} ·{" "}
            {formatRelativeTime(notification.created_at)}
          </span>
        </span>
      </button>
      {unread && (
        <>
          {/* Punto "no leída": se oculta al hover para dar paso al botón */}
          <span
            className="pointer-events-none absolute right-3.5 top-1/2 size-2 -translate-y-1/2 rounded-full bg-brand-teal transition-opacity group-hover/item:opacity-0"
            aria-hidden
          />
          <button
            type="button"
            aria-label="Marcar como leída"
            title="Marcar como leída"
            onClick={() => {
              onRead(notification.id);
            }}
            className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-brand-teal opacity-0 transition-all hover:bg-brand-teal/10 focus-visible:opacity-100 group-hover/item:opacity-100"
          >
            <Check className="size-4" />
          </button>
        </>
      )}
    </li>
  );
}

export function NotificationBell({ placement = "down" }: { placement?: "down" | "up" }) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"todas" | "no_leidas">("todas");

  const unreadQuery = useUnreadCount(isAuthenticated);
  const listQuery = useNotifications(open && isAuthenticated);
  const markAll = useMarkAllRead();
  const markRead = useMarkRead();

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
                    />
                  ))}
                </ul>
              )}
            </div>

            {total > items.length && (
              <div className="shrink-0 border-t border-slate-100 px-4 py-2 text-center text-[11px] text-slate-400 dark:border-slate-800 dark:text-slate-500">
                Mostrando {items.length} de {total}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
