import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Bell, Check, CheckCheck, Filter, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/common/AsyncStates";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  useDeleteNotification,
  useMarkAllRead,
  useMarkRead,
  useNotificationsList,
} from "../hooks/use-notifications";
import { resolveNotificationTarget } from "../utils/notification-target";
import {
  NOTIFICATION_PRIORITY_LABELS,
  formatRelativeTime,
  notificationPriority,
  notificationTypeLabel,
  type NotificationPriority,
} from "../utils/notifications";
import { DEFAULT_TONE, FALLBACK_ICON, TYPE_ICON, TYPE_TONE } from "../utils/notification-visuals";
import type { AppNotification, NotificationType } from "../types";

const PAGE_STEP = 40;

type StatusFilter = "todas" | "no_leidas" | "leidas";

const PRIORITY_DOT: Record<NotificationPriority, string> = {
  alta: "bg-rose-500",
  media: "bg-amber-400",
  baja: "bg-slate-300 dark:bg-slate-600",
};

/** Los tipos presentes en la ventana cargada, para poblar el selector. */
function typesInWindow(items: AppNotification[]): NotificationType[] {
  const seen = new Set<NotificationType>();
  for (const n of items) {
    seen.add(n.notification_type);
  }
  return [...seen].sort((a, b) => notificationTypeLabel(a).localeCompare(notificationTypeLabel(b)));
}

function Row({
  n,
  onOpen,
  onRead,
  onDelete,
}: {
  n: AppNotification;
  onOpen: (n: AppNotification) => void;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const Icon = TYPE_ICON[n.notification_type] ?? FALLBACK_ICON;
  const tone = TYPE_TONE[n.notification_type] ?? DEFAULT_TONE;
  const priority = notificationPriority(n.notification_type);
  const unread = !n.is_read;

  return (
    <li
      className={cn(
        "group/row flex items-start gap-3 rounded-lg border border-transparent px-3 py-3 transition-colors hover:border-border hover:bg-accent/40",
        unread && "bg-brand-teal/[0.05] dark:bg-brand-teal/10",
      )}
    >
      <span
        className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", tone)}
      >
        <Icon className="size-4" />
      </span>

      <button
        type="button"
        onClick={() => {
          onOpen(n);
        }}
        className="min-w-0 flex-1 text-left"
      >
        <span className={cn("block text-sm leading-snug text-foreground", unread && "font-medium")}>
          {n.message}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className={cn("size-1.5 rounded-full", PRIORITY_DOT[priority])} />
            {NOTIFICATION_PRIORITY_LABELS[priority]}
          </span>
          <span>·</span>
          <span>{notificationTypeLabel(n.notification_type)}</span>
          <span>·</span>
          <span>{formatRelativeTime(n.created_at)}</span>
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-0.5">
        {unread && (
          <button
            type="button"
            title="Marcar como leída"
            aria-label="Marcar como leída"
            onClick={() => {
              onRead(n.id);
            }}
            className="flex size-7 items-center justify-center rounded-full text-brand-teal opacity-0 transition hover:bg-brand-teal/10 focus-visible:opacity-100 group-hover/row:opacity-100"
          >
            <Check className="size-4" />
          </button>
        )}
        <button
          type="button"
          title="Eliminar"
          aria-label="Eliminar notificación"
          onClick={() => {
            onDelete(n.id);
          }}
          className="flex size-7 items-center justify-center rounded-full text-slate-400 opacity-0 transition hover:bg-rose-500/10 hover:text-rose-500 focus-visible:opacity-100 group-hover/row:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </li>
  );
}

/**
 * Vista completa de notificaciones. El backend solo pagina y filtra por
 * leídas/no leídas; el resto (texto, prioridad derivada del tipo, tipo, rango
 * de fechas) se filtra en cliente sobre la ventana cargada, que crece con
 * "Cargar más".
 */
export function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pageSize, setPageSize] = useState(PAGE_STEP);
  const query = useNotificationsList(pageSize);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const deleteOne = useDeleteNotification();

  const [text, setText] = useState("");
  const [status, setStatus] = useState<StatusFilter>("todas");
  const [priority, setPriority] = useState<NotificationPriority | "all">("all");
  const [type, setType] = useState<NotificationType | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const total = query.data?.total ?? items.length;
  const unread = query.data?.unread_count ?? 0;
  const typeOptions = useMemo(() => typesInWindow(items), [items]);

  const filtered = useMemo(() => {
    const needle = text.trim().toLowerCase();
    const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toTs = to ? new Date(`${to}T23:59:59`).getTime() : null;
    return items.filter((n) => {
      if (status === "no_leidas" && n.is_read) {
        return false;
      }
      if (status === "leidas" && !n.is_read) {
        return false;
      }
      if (needle && !n.message.toLowerCase().includes(needle)) {
        return false;
      }
      if (priority !== "all" && notificationPriority(n.notification_type) !== priority) {
        return false;
      }
      if (type !== "all" && n.notification_type !== type) {
        return false;
      }
      const ts = new Date(n.created_at).getTime();
      if (fromTs !== null && ts < fromTs) {
        return false;
      }
      if (toTs !== null && ts > toTs) {
        return false;
      }
      return true;
    });
  }, [items, text, status, priority, type, from, to]);

  const anyFilter =
    text.trim() !== "" ||
    status !== "todas" ||
    priority !== "all" ||
    type !== "all" ||
    from !== "" ||
    to !== "";

  const resetFilters = () => {
    setText("");
    setStatus("todas");
    setPriority("all");
    setType("all");
    setFrom("");
    setTo("");
  };

  const open = (n: AppNotification) => {
    if (!n.is_read) {
      markRead.mutate(n.id);
    }
    const target = resolveNotificationTarget(n, user?.role);
    if (target) {
      void navigate(target);
    }
  };

  const selectClass =
    "rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-brand-gold";

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 sm:p-5">
      <PageHeader
        title="Notificaciones"
        description="Todo lo que ha pasado en tus proyectos, tareas y entregas."
        breadcrumb={[{ label: "Inicio", href: "/" }, { label: "Notificaciones" }]}
        actions={
          <button
            type="button"
            disabled={unread === 0 || markAll.isPending}
            onClick={() => {
              markAll.mutate();
            }}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-brand-teal transition hover:bg-brand-teal/10 disabled:cursor-not-allowed disabled:text-muted-foreground"
          >
            <CheckCheck className="size-4" />
            Marcar todas
          </button>
        }
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
            }}
            placeholder="Buscar en el mensaje…"
            className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-2 text-sm outline-none focus:border-brand-gold"
          />
        </div>

        <select
          aria-label="Estado de lectura"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as StatusFilter);
          }}
          className={selectClass}
        >
          <option value="todas">Todas</option>
          <option value="no_leidas">No leídas</option>
          <option value="leidas">Leídas</option>
        </select>

        <select
          aria-label="Prioridad"
          value={priority}
          onChange={(e) => {
            setPriority(e.target.value as NotificationPriority | "all");
          }}
          className={selectClass}
        >
          <option value="all">Toda prioridad</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>

        {typeOptions.length > 1 && (
          <select
            aria-label="Tipo"
            value={type}
            onChange={(e) => {
              setType(e.target.value as NotificationType | "all");
            }}
            className={cn(selectClass, "max-w-[16rem]")}
          >
            <option value="all">Todos los tipos</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {notificationTypeLabel(t)}
              </option>
            ))}
          </select>
        )}

        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          Desde
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => {
              setFrom(e.target.value);
            }}
            className={selectClass}
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          Hasta
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => {
              setTo(e.target.value);
            }}
            className={selectClass}
          />
        </label>

        {anyFilter && (
          <button
            type="button"
            onClick={resetFilters}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <X className="size-3.5" />
            Limpiar
          </button>
        )}
      </div>

      {query.isLoading && <LoadingSkeleton rows={6} />}
      {query.isError && (
        <ErrorState
          title="No se pudieron cargar las notificaciones"
          onRetry={() => void query.refetch()}
        />
      )}

      {query.data && (
        <>
          <p className="text-xs text-muted-foreground">
            {filtered.length === items.length
              ? `${String(items.length)} de ${String(total)}`
              : `${String(filtered.length)} de ${String(items.length)} cargadas · ${String(total)} en total`}
          </p>

          {filtered.length === 0 ? (
            <EmptyState
              icon={anyFilter ? Filter : Bell}
              title={anyFilter ? "Nada coincide con el filtro" : "No tienes notificaciones"}
              hint={
                anyFilter
                  ? "Prueba a ampliar el rango de fechas o quitar algún filtro."
                  : "Cuando pase algo en tus proyectos, aparecerá aquí."
              }
            />
          ) : (
            <ul className="flex flex-col gap-1">
              {filtered.map((n) => (
                <Row
                  key={n.id}
                  n={n}
                  onOpen={open}
                  onRead={(id) => {
                    markRead.mutate(id);
                  }}
                  onDelete={(id) => {
                    deleteOne.mutate(id);
                  }}
                />
              ))}
            </ul>
          )}

          {items.length < total && (
            <button
              type="button"
              onClick={() => {
                setPageSize((n) => n + PAGE_STEP);
              }}
              disabled={query.isFetching}
              className="mx-auto mt-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              {query.isFetching
                ? "Cargando…"
                : `Cargar ${String(Math.min(PAGE_STEP, total - items.length))} más`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
