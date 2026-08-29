import { Link2Off, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiTeamMember, ProjectTaskStatus } from "../api/workspace.api";
import { STATUS_META } from "../utils/team-tasks";
import {
  UNASSIGNED,
  activeTeamTaskFilterCount,
  type TeamTaskFilters,
} from "../utils/team-task-filters";

const STATUS_OPTIONS: ProjectTaskStatus[] = [
  "pendiente_por_iniciar",
  "en_progreso",
  "en_revision",
  "devuelta",
  "completada",
  "cancelada",
];

const selectClass =
  "rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-600 outline-none focus:border-brand-gold dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";

interface Props {
  filters: TeamTaskFilters;
  onChange: (patch: Partial<TeamTaskFilters>) => void;
  onReset: () => void;
  teamMembers: ApiTeamMember[];
  /** Total tras filtrar / total sin filtrar, para el resumen. */
  shown: number;
  totalTasks: number;
}

/**
 * Barra de filtros de las tareas del equipo. Filtra el conjunto ANTES de
 * agrupar, así Lista, Kanban y Estructura ven el mismo subconjunto.
 */
export function TeamTaskFilterBar({
  filters,
  onChange,
  onReset,
  teamMembers,
  shown,
  totalTasks,
}: Props) {
  const active = activeTeamTaskFilterCount(filters);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={filters.text}
          onChange={(e) => {
            onChange({ text: e.target.value });
          }}
          placeholder="Buscar tarea…"
          className="w-44 rounded-md border border-slate-200 bg-white py-1 pl-7 pr-2 text-[12px] text-slate-700 outline-none focus:border-brand-gold dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        />
      </div>

      <select
        aria-label="Filtrar por estado"
        value={filters.status}
        onChange={(e) => {
          onChange({ status: e.target.value as TeamTaskFilters["status"] });
        }}
        className={selectClass}
      >
        <option value="all">Todos los estados</option>
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {STATUS_META[s].label}
          </option>
        ))}
      </select>

      <select
        aria-label="Filtrar por responsable"
        value={filters.assignee}
        onChange={(e) => {
          onChange({ assignee: e.target.value });
        }}
        className={selectClass}
      >
        <option value="all">Cualquier responsable</option>
        <option value={UNASSIGNED}>Sin responsable</option>
        {teamMembers.map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {m.name} {m.last_name}
          </option>
        ))}
      </select>

      <button
        type="button"
        aria-pressed={filters.onlyBlocked}
        onClick={() => {
          onChange({ onlyBlocked: !filters.onlyBlocked });
        }}
        className={cn(
          "flex items-center gap-1 rounded-md border px-2 py-1 text-[12px] font-medium transition-colors",
          filters.onlyBlocked
            ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400"
            : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800",
        )}
      >
        <Link2Off className="size-3.5" />
        Bloqueadas
      </button>

      {active > 0 && (
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          <X className="size-3.5" />
          Limpiar
        </button>
      )}

      <div className="flex-1" />

      <span className="text-[11px] text-slate-400 dark:text-slate-500">
        {active > 0 && shown !== totalTasks
          ? `${String(shown)} de ${String(totalTasks)} tareas`
          : `${String(totalTasks)} tarea${totalTasks === 1 ? "" : "s"}`}
      </span>
    </div>
  );
}
