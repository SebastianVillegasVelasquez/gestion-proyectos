import { useMemo, useState } from "react";
import {
  Plus,
  ArrowLeftRight,
  UserCheck,
  MessageSquare,
  AlertTriangle,
  Zap,
  Clock,
  TrendingUp,
  Search,
  X,
  ChevronDown,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StoredProject } from "../../context/ProjectsContext";
import type { TaskHistory, HistoryAction } from "./types";
import { HISTORY_ACTION_LABELS, HISTORY_ACTION_OPTIONS } from "./types";
import { TASK_STATUS_LABELS, TASK_STATUS_OPTIONS, STATUS_BADGE } from "../types";
import type { TaskStatus } from "../types";
import { PROJECT_ROLE_LABELS } from "../../types";

// ── mock / demo data ───────────────────────────────────────────────────────

const RETURN_REASONS = [
  "El componente no sigue el sistema de diseño establecido.",
  "Faltan las validaciones de formulario requeridas en el flujo.",
  "Las pruebas unitarias están incompletas; cobertura < 80 %.",
  "La documentación técnica no fue entregada junto con el PR.",
  "El rendimiento en móvil no cumple los criterios de aceptación.",
];

function generateDemoHistory(stored: StoredProject): TaskHistory[] {
  const { tasks, members } = stored;
  if (tasks.length === 0 || members.length === 0) {return [];}

  const entries: TaskHistory[] = [];
  let offsetMs = 6 * 24 * 60 * 60 * 1000; // start 6 days back
  const base = Date.now();

  const m = (i: number) => members[i % members.length].id;

  tasks.slice(0, 7).forEach((task, idx) => {
    const ts = () => {
      const t = new Date(base - offsetMs).toISOString();
      offsetMs -= (idx + 1) * 55 * 60 * 1000;
      return t;
    };

    // Creation
    entries.push({
      id: `demo_${idx}_create`,
      task_id: task.id,
      changed_by_id: m(0),
      action: "creacion",
      old_status: null,
      new_status: "pendiente_por_iniciar",
      change_reason: "",
      created_at: ts(),
    });

    if (task.status !== "pendiente_por_iniciar") {
      entries.push({
        id: `demo_${idx}_start`,
        task_id: task.id,
        changed_by_id: m(idx + 1),
        action: "cambio_estado",
        old_status: "pendiente_por_iniciar",
        new_status: "en_progreso",
        change_reason: "",
        created_at: ts(),
      });
    }

    // One in three tasks gets a rejection cycle
    if (idx % 3 === 0 && task.status !== "pendiente_por_iniciar") {
      entries.push({
        id: `demo_${idx}_review`,
        task_id: task.id,
        changed_by_id: m(idx),
        action: "cambio_estado",
        old_status: "en_progreso",
        new_status: "en_revision",
        change_reason: "",
        created_at: ts(),
      });
      entries.push({
        id: `demo_${idx}_return`,
        task_id: task.id,
        changed_by_id: m(0),
        action: "cambio_estado",
        old_status: "en_revision",
        new_status: "devuelta",
        change_reason: RETURN_REASONS[idx % RETURN_REASONS.length],
        created_at: ts(),
      });
    }

    // Reassignment on even tasks with > 1 member
    if (idx % 2 === 0 && members.length > 1) {
      entries.push({
        id: `demo_${idx}_reassign`,
        task_id: task.id,
        changed_by_id: m(1),
        action: "reasignacion",
        old_status: task.status,
        new_status: task.status,
        change_reason: "",
        created_at: ts(),
      });
    }

    if (task.status === "completada") {
      entries.push({
        id: `demo_${idx}_done`,
        task_id: task.id,
        changed_by_id: m(idx),
        action: "cambio_estado",
        old_status: "en_revision",
        new_status: "completada",
        change_reason: "",
        created_at: ts(),
      });
    }
  });

  return entries.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

// ── KPI metrics ────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  sub: string;
  accentClass: string; // e.g. "from-blue-500 to-indigo-600"
  icon: React.ReactNode;
}

function KpiCard({ label, value, sub, accentClass, icon }: KpiCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {/* Gradient left accent bar */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-1 rounded-l-xl bg-gradient-to-b",
          accentClass
        )}
      />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-800 dark:text-slate-100">
            {value}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800">{icon}</div>
      </div>
    </div>
  );
}

// ── filter bar ─────────────────────────────────────────────────────────────

interface FilterBarProps {
  search: string;
  filterAction: HistoryAction | "";
  filterStatus: TaskStatus | "";
  onSearch: (v: string) => void;
  onFilterAction: (v: HistoryAction | "") => void;
  onFilterStatus: (v: TaskStatus | "") => void;
  onClear: () => void;
  hasFilters: boolean;
}

const selectCls =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-blue-500 appearance-none pr-7 cursor-pointer";

function FilterBar({
  search,
  filterAction,
  filterStatus,
  onSearch,
  onFilterAction,
  onFilterStatus,
  onClear,
  hasFilters,
}: FilterBarProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
      {/* Search */}
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => { onSearch(e.target.value); }}
          placeholder="Buscar por tarea o usuario..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-[13px] text-slate-700 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-blue-500"
        />
      </div>

      {/* Action filter */}
      <div className="relative">
        <select
          value={filterAction}
          onChange={(e) => { onFilterAction(e.target.value as HistoryAction | ""); }}
          className={selectCls}
        >
          <option value="">Todas las acciones</option>
          {HISTORY_ACTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-slate-400" />
      </div>

      {/* Status filter */}
      <div className="relative">
        <select
          value={filterStatus}
          onChange={(e) => { onFilterStatus(e.target.value as TaskStatus | ""); }}
          className={selectCls}
        >
          <option value="">Todos los estados</option>
          {TASK_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-slate-400" />
      </div>

      {/* Clear */}
      {hasFilters && (
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[12px] text-slate-500 transition-colors hover:border-rose-200 hover:text-rose-600 dark:border-slate-700 dark:hover:border-rose-800 dark:hover:text-rose-400"
        >
          <X className="size-3" />
          Limpiar
        </button>
      )}
    </div>
  );
}

// ── timeline node icons ────────────────────────────────────────────────────

const ACTION_NODE: Record<
  HistoryAction,
  { Icon: React.ElementType; bg: string; ring: string }
> = {
  creacion: {
    Icon: Plus,
    bg: "bg-emerald-500",
    ring: "ring-emerald-100 dark:ring-emerald-900/30",
  },
  cambio_estado: {
    Icon: ArrowLeftRight,
    bg: "bg-blue-500",
    ring: "ring-blue-100 dark:ring-blue-900/30",
  },
  reasignacion: {
    Icon: UserCheck,
    bg: "bg-violet-500",
    ring: "ring-violet-100 dark:ring-violet-900/30",
  },
  comentario: {
    Icon: MessageSquare,
    bg: "bg-slate-400 dark:bg-slate-600",
    ring: "ring-slate-100 dark:ring-slate-800",
  },
};

// ── date formatting ────────────────────────────────────────────────────────

function formatDateTime(iso: string): { date: string; time: string; relative: string } {
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffH = diffMs / 3_600_000;
  const diffD = diffMs / 86_400_000;

  let relative: string;
  if (diffH < 1) {
    relative = "Hace menos de 1 h";
  } else if (diffH < 24) {
    relative = `Hace ${Math.floor(diffH)} h`;
  } else if (diffD < 7) {
    relative = `Hace ${Math.floor(diffD)} días`;
  } else {
    relative = d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
  }

  return {
    date: d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" }),
    time: d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }),
    relative,
  };
}

// ── timeline item ──────────────────────────────────────────────────────────

interface TimelineItemProps {
  entry: TaskHistory;
  taskName: string;
  memberName: string;
  memberInitials: string;
  memberColor: string;
  index: number;
}

function buildDescription(
  entry: TaskHistory,
  memberName: string,
  taskName: string
): string {
  switch (entry.action) {
    case "creacion":
      return `${memberName} creó la tarea "${taskName}"`;
    case "cambio_estado":
      if (entry.old_status && entry.new_status) {
        return `${memberName} movió "${taskName}" de ${TASK_STATUS_LABELS[entry.old_status]} a ${TASK_STATUS_LABELS[entry.new_status]}`;
      }
      return `${memberName} actualizó el estado de "${taskName}"`;
    case "reasignacion":
      return `${memberName} fue asignado/a a la tarea "${taskName}"`;
    case "comentario":
      return `${memberName} dejó un comentario en "${taskName}"`;
    default:
      return `${memberName} realizó una acción en "${taskName}"`;
  }
}

function TimelineItem({
  entry,
  taskName,
  memberName,
  memberInitials,
  memberColor,
  index,
}: TimelineItemProps) {
  const isAlert =
    entry.new_status === "devuelta" || Boolean(entry.change_reason);
  const node =
    isAlert && entry.action === "cambio_estado"
      ? { Icon: AlertTriangle, bg: "bg-rose-500", ring: "ring-rose-100 dark:ring-rose-900/30" }
      : ACTION_NODE[entry.action];

  const { Icon } = node;
  const dt = formatDateTime(entry.created_at);

  return (
    <div
      className="flex gap-4"
      style={{
        animation: "tl-enter 0.35s ease-out both",
        animationDelay: `${index * 45}ms`,
      }}
    >
      {/* Left: timestamp */}
      <div className="flex w-24 shrink-0 flex-col items-end pt-2.5">
        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
          {dt.date}
        </span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">{dt.time}</span>
        <span className="mt-0.5 text-[9px] italic text-slate-300 dark:text-slate-600">
          {dt.relative}
        </span>
      </div>

      {/* Center: icon + connector line */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4",
            node.bg,
            node.ring
          )}
        >
          <Icon className="size-4 text-white" />
        </div>
        {/* Connector (rendered by parent AuditTimeline) */}
      </div>

      {/* Right: card */}
      <div className="mb-5 flex-1 pb-1">
        <div
          className={cn(
            "rounded-xl border p-4 shadow-sm transition-colors",
            isAlert
              ? "border-rose-200 bg-rose-50 dark:border-rose-800/50 dark:bg-rose-950/20"
              : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          )}
        >
          {/* Card header */}
          <div className="flex items-start gap-3">
            {/* Member avatar */}
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
                memberColor
              )}
              title={memberName}
            >
              {memberInitials}
            </span>

            <div className="flex-1">
              <p
                className={cn(
                  "text-[13px] font-medium leading-snug",
                  isAlert
                    ? "text-rose-800 dark:text-rose-200"
                    : "text-slate-700 dark:text-slate-200"
                )}
              >
                {buildDescription(entry, memberName, taskName)}
              </p>

              {/* Status badges */}
              {entry.old_status && entry.new_status && (
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      STATUS_BADGE[entry.old_status]
                    )}
                  >
                    {TASK_STATUS_LABELS[entry.old_status]}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">→</span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      STATUS_BADGE[entry.new_status]
                    )}
                  >
                    {TASK_STATUS_LABELS[entry.new_status]}
                  </span>
                </div>
              )}
            </div>

            {/* Action badge */}
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {HISTORY_ACTION_LABELS[entry.action]}
            </span>
          </div>

          {/* Change reason blockquote */}
          {entry.change_reason && (
            <blockquote className="mt-3 flex gap-2.5 rounded-lg border-l-4 border-rose-400 bg-rose-100/60 p-3 dark:border-rose-600 dark:bg-rose-900/20">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-500 dark:text-rose-400" />
              <p className="text-[12px] italic leading-relaxed text-rose-800 dark:text-rose-300">
                "{entry.change_reason}"
              </p>
            </blockquote>
          )}
        </div>
      </div>
    </div>
  );
}

// ── audit timeline ─────────────────────────────────────────────────────────

interface AuditTimelineProps {
  entries: TaskHistory[];
  stored: StoredProject;
}

function AuditTimeline({ entries, stored }: AuditTimelineProps) {
  const getMemberData = (id: string) => {
    const m = stored.members.find((m) => m.id === id);
    return {
      name: m
        ? `${m.name} (${PROJECT_ROLE_LABELS[m.role]})`
        : "Sistema",
      initials: m?.initials ?? "S",
      color: m?.avatarColor ?? "bg-slate-400",
    };
  };

  const getTaskName = (id: string) =>
    stored.tasks.find((t) => t.id === id)?.title ?? "Tarea eliminada";

  if (entries.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
          <Activity className="size-5 text-slate-400 dark:text-slate-500" />
        </div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Sin resultados
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Ajusta los filtros para ver más registros.
        </p>
      </div>
    );
  }

  return (
    <div className="relative px-5 pb-8 pt-6">
      {/* Vertical connector line behind nodes */}
      <div
        className="pointer-events-none absolute top-6 bottom-8 bg-slate-200 dark:bg-slate-700"
        style={{ left: "calc(6rem + 1.125rem)", width: 2 }}
      />

      <div className="flex flex-col">
        {entries.map((entry, idx) => {
          const member = getMemberData(entry.changed_by_id);
          return (
            <TimelineItem
              key={entry.id}
              entry={entry}
              taskName={getTaskName(entry.task_id)}
              memberName={member.name}
              memberInitials={member.initials}
              memberColor={member.color}
              index={idx}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── main dashboard ─────────────────────────────────────────────────────────

interface TraceabilityDashboardProps {
  stored: StoredProject;
}

export function TraceabilityDashboard({ stored }: TraceabilityDashboardProps) {
  // Use real history when available; fall back to demo data
  const isDemo = stored.history.length === 0;
  const allEntries = useMemo(
    () => (isDemo ? generateDemoHistory(stored) : stored.history),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stored.history, isDemo]
  );

  // Filters
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState<HistoryAction | "">("");
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "">("");

  const hasFilters = Boolean(search || filterAction || filterStatus);

  const clearFilters = () => {
    setSearch("");
    setFilterAction("");
    setFilterStatus("");
  };

  // Filtered entries
  const filteredEntries = useMemo(() => {
    const s = search.toLowerCase();
    return allEntries.filter((e) => {
      if (filterAction && e.action !== filterAction) {return false;}
      if (filterStatus && e.new_status !== filterStatus) {return false;}
      if (s) {
        const taskName =
          stored.tasks.find((t) => t.id === e.task_id)?.title?.toLowerCase() ?? "";
        const member =
          stored.members.find((m) => m.id === e.changed_by_id)?.name?.toLowerCase() ?? "";
        if (!taskName.includes(s) && !member.includes(s)) {return false;}
      }
      return true;
    });
  }, [allEntries, filterAction, filterStatus, search, stored.tasks, stored.members]);

  // KPIs
  const kpi = useMemo(() => {
    const totalAcciones = allEntries.length;
    const devueltas = allEntries.filter((e) => e.new_status === "devuelta").length;
    const completadas = stored.tasks.filter((t) => t.status === "completada").length;
    const pct =
      stored.tasks.length > 0
        ? Math.round((completadas / stored.tasks.length) * 100)
        : 0;
    const last = allEntries[0]
      ? formatDateTime(allEntries[0].created_at).relative
      : "—";

    return { totalAcciones, devueltas, last, pct, completadas };
  }, [allEntries, stored.tasks]);

  const trulyEmpty = allEntries.length === 0;

  if (trulyEmpty) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
          <Activity className="size-6 text-slate-400 dark:text-slate-500" />
        </div>
        <p className="font-semibold text-slate-700 dark:text-slate-200">
          Aún no hay historial de cambios
        </p>
        <p className="max-w-xs text-sm text-slate-400 dark:text-slate-500">
          Las acciones realizadas en las tareas (crear, cambiar estado, reasignar)
          aparecerán aquí automáticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* ─ Demo banner ─ */}
      {isDemo && (
        <div className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2 dark:border-amber-800/40 dark:bg-amber-950/30">
          <Zap className="size-3.5 shrink-0 text-amber-500" />
          <p className="text-[11px] text-amber-700 dark:text-amber-400">
            <strong>Vista previa con datos demo.</strong> El historial real se
            genera automáticamente al crear y modificar tareas.
          </p>
        </div>
      )}

      {/* ─ KPI cards ─ */}
      <div className="grid shrink-0 grid-cols-2 gap-4 p-5 lg:grid-cols-4">
        <KpiCard
          label="Total de acciones"
          value={kpi.totalAcciones}
          sub={`En este proyecto`}
          accentClass="from-blue-500 to-indigo-600"
          icon={<Activity className="size-5 text-blue-500" />}
        />
        <KpiCard
          label="Tareas devueltas"
          value={kpi.devueltas}
          sub="Cuellos de botella"
          accentClass="from-rose-500 to-pink-600"
          icon={<AlertTriangle className="size-5 text-rose-500" />}
        />
        <KpiCard
          label="Última actividad"
          value={kpi.last}
          sub="Registro más reciente"
          accentClass="from-amber-400 to-orange-500"
          icon={<Clock className="size-5 text-amber-500" />}
        />
        <KpiCard
          label="Avance del proyecto"
          value={`${kpi.pct} %`}
          sub={`${kpi.completadas} tareas completadas`}
          accentClass="from-emerald-500 to-teal-600"
          icon={<TrendingUp className="size-5 text-emerald-500" />}
        />
      </div>

      {/* ─ Filter bar ─ */}
      <FilterBar
        search={search}
        filterAction={filterAction}
        filterStatus={filterStatus}
        onSearch={setSearch}
        onFilterAction={setFilterAction}
        onFilterStatus={setFilterStatus}
        onClear={clearFilters}
        hasFilters={hasFilters}
      />

      {/* ─ Results count ─ */}
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-5 py-2 dark:border-slate-800 dark:bg-slate-900">
        <span className="text-[12px] text-slate-400 dark:text-slate-500">
          {filteredEntries.length === allEntries.length
            ? `${allEntries.length} registros en total`
            : `${filteredEntries.length} de ${allEntries.length} registros`}
        </span>
      </div>

      {/* ─ Timeline (scrollable) ─ */}
      <div className="flex-1 overflow-y-auto">
        <AuditTimeline entries={filteredEntries} stored={stored} />
      </div>
    </div>
  );
}
