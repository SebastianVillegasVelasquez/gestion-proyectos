import { useMemo, useState } from "react";
import { Link2, Package, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Deliverable, WorkspaceMember, DeliverableStatus } from "../types";
import { DELIVERABLE_STATUS_LABELS, DELIVERABLE_STATUS_BADGE } from "../types";
import { RESOURCE_META } from "../utils/resource-types";
import {
  EMPTY_DELIVERABLE_FILTERS,
  activeDeliverableFilterCount,
  filterDeliverables,
  type DeliverableFilters,
} from "../utils/deliverable-filters";
import { useClientPagination } from "../hooks/use-client-pagination";
import { Pager } from "./Pager";

// Columna estrecha: pocas filas por página bastan y evitan un scroll larguísimo.
const PAGE_SIZE = 10;

const STATUS_OPTIONS: DeliverableStatus[] = [
  "borrador",
  "en_revision",
  "aprobado",
  "cambios_solicitados",
  "rechazado",
];

function StatusBadge({ status }: { status: DeliverableStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        DELIVERABLE_STATUS_BADGE[status],
      )}
    >
      {DELIVERABLE_STATUS_LABELS[status]}
    </span>
  );
}

function DeliverableIcon({ d }: { d: Deliverable }) {
  const latest = d.versions.at(-1);
  if (!latest) {
    return <Package className="size-4 text-slate-400" />;
  }
  const meta = RESOURCE_META[latest.type];
  const Icon = meta.Icon;
  return <Icon className={cn("size-4", meta.color)} />;
}

const selectClass =
  "min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 outline-none focus:border-brand-gold dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";

interface DeliverableListProps {
  deliverables: Deliverable[];
  members: WorkspaceMember[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function DeliverableList({
  deliverables,
  members,
  selectedId,
  onSelect,
}: DeliverableListProps) {
  const getMember = (id: string) => members.find((m) => m.id === id);
  const [filters, setFilters] = useState<DeliverableFilters>(EMPTY_DELIVERABLE_FILTERS);

  // Solo ofrecemos como responsables a quien realmente tiene algún entregable.
  const assigneeOptions = useMemo(() => {
    const ids = new Set(deliverables.map((d) => d.assigneeId));
    return members.filter((m) => ids.has(m.id));
  }, [deliverables, members]);

  const filtered = useMemo(
    () => filterDeliverables(deliverables, filters),
    [deliverables, filters],
  );
  const { page, totalPages, pageItems, total, setPage, next, prev } = useClientPagination(
    filtered,
    PAGE_SIZE,
  );
  const hasFilters = activeDeliverableFilterCount(filters) > 0;

  const patch = (p: Partial<DeliverableFilters>) => {
    setFilters((f) => ({ ...f, ...p }));
    setPage(1);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Entregables
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {deliverables.length}
        </span>
      </div>

      {/* Filtros */}
      <div className="flex shrink-0 flex-col gap-1.5 border-b border-slate-200 px-3 py-2.5 dark:border-slate-700">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={filters.text}
            onChange={(e) => {
              patch({ text: e.target.value });
            }}
            placeholder="Buscar por título…"
            className="w-full rounded-md border border-slate-200 bg-white py-1.5 pl-7 pr-7 text-[12px] text-slate-700 outline-none focus:border-brand-gold dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
          {filters.text && (
            <button
              type="button"
              aria-label="Limpiar búsqueda"
              onClick={() => {
                patch({ text: "" });
              }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <select
            aria-label="Filtrar por estado"
            value={filters.status}
            onChange={(e) => {
              patch({ status: e.target.value as DeliverableFilters["status"] });
            }}
            className={selectClass}
          >
            <option value="all">Todos los estados</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {DELIVERABLE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por responsable"
            value={filters.assignee}
            onChange={(e) => {
              patch({ assignee: e.target.value });
            }}
            className={selectClass}
          >
            <option value="all">Todos</option>
            {assigneeOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2">
        {total === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
            {hasFilters ? "Ningún entregable coincide con el filtro." : "Sin entregables aún."}
          </p>
        ) : (
          pageItems.map((d) => {
            const assignee = getMember(d.assigneeId);
            const isSelected = d.id === selectedId;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  onSelect(d.id);
                }}
                className={cn(
                  "group w-full border-l-2 px-4 py-3.5 text-left transition-colors duration-100",
                  isSelected
                    ? "border-l-brand-gold bg-brand-gold-light"
                    : "border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40",
                )}
              >
                {/* Title row */}
                <div className="flex items-start gap-2.5">
                  <div
                    className={cn(
                      "mt-0.5 shrink-0 rounded-md p-1",
                      isSelected ? "bg-brand-gold-light" : "bg-slate-100 dark:bg-slate-800",
                    )}
                  >
                    <DeliverableIcon d={d} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-[13px] font-medium leading-snug",
                        isSelected
                          ? "text-brand-gold-dark dark:text-brand-gold"
                          : "text-slate-700 dark:text-slate-200",
                      )}
                    >
                      {d.taskTitle}
                    </p>

                    {/* Assignee */}
                    {assignee && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white",
                            assignee.avatarColor,
                          )}
                        >
                          {assignee.initials}
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          {assignee.name}
                        </span>
                      </div>
                    )}

                    {/* Footer: status + vínculo con la tarea + version count */}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={d.status} />
                      {d.taskId && (
                        <span
                          title="Vinculado a una tarea del proyecto"
                          className="inline-flex items-center gap-1 rounded-full bg-brand-teal/10 px-2 py-0.5 text-[10px] font-medium text-brand-teal-dark dark:text-brand-teal"
                        >
                          <Link2 className="size-2.5" /> Tarea vinculada
                        </span>
                      )}
                      {d.versions.length > 0 && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          {d.versions.length} versión{d.versions.length !== 1 ? "es" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Paginación */}
      {total > 0 && (
        <div className="shrink-0 border-t border-slate-200 px-3 py-2 dark:border-slate-700">
          <Pager
            page={page}
            totalPages={totalPages}
            onPrev={prev}
            onNext={next}
            summary={
              hasFilters
                ? `${String(total)} de ${String(deliverables.length)}`
                : `${String(total)} entregable${total === 1 ? "" : "s"}`
            }
          />
        </div>
      )}
    </div>
  );
}
