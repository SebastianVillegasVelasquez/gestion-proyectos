import { useMemo } from "react";
import { CalendarRange, FolderTree, Search, SlidersHorizontal, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "../types/labels";
import type {
  ProjectMember,
  Team,
  TaskPriority,
  TaskStatus,
  WorkItemTree,
} from "../types/api.types";
import {
  UNASSIGNED,
  activeFilterCount,
  parentLocationOptions,
  type TaskFilters,
  type TaskFiltersAction,
} from "./task-filters";

const STATUSES = Object.keys(TASK_STATUS_LABELS) as TaskStatus[];
const PRIORITIES = Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[];

const controlCls =
  "h-9 rounded-xl border border-border bg-card px-2.5 text-xs text-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";

interface Props {
  filters: TaskFilters;
  dispatch: React.Dispatch<TaskFiltersAction>;
  teams: Team[];
  members: ProjectMember[];
  tree: WorkItemTree[];
}

/**
 * Filtros de la pantalla de tareas.
 *
 * Todo en una fila y siempre visible, sin desplegar un panel: en un proyecto de
 * cientos de tareas, filtrar no es una acción ocasional sino la forma normal de
 * usar la pantalla, y esconderla tras un botón añade un clic a cada consulta.
 */
export function TaskFilterBar({ filters, dispatch, teams, members, tree }: Props) {
  const set = (change: Partial<Omit<TaskFilters, "page">>) => {
    dispatch({ type: "set", change });
  };

  // Solo elementos que contienen algo: filtrar por una hoja equivale a filtrar
  // por una tarea suelta y llenaría la lista de cientos de entradas inútiles.
  const locations = useMemo(() => parentLocationOptions(tree), [tree]);
  const active = activeFilterCount(filters);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={filters.search}
          onChange={(e) => {
            set({ search: e.target.value });
          }}
          placeholder="Buscar tarea…"
          aria-label="Buscar tarea"
          className={cn(controlCls, "w-48 pl-9 pr-3 sm:w-56")}
        />
      </div>

      <select
        value={filters.status}
        onChange={(e) => {
          set({ status: e.target.value as TaskFilters["status"] });
        }}
        aria-label="Filtrar por estado"
        className={controlCls}
      >
        <option value="todos">Todos los estados</option>
        {STATUSES.map((status) => (
          <option key={status} value={status}>
            {TASK_STATUS_LABELS[status]}
          </option>
        ))}
      </select>

      <select
        value={filters.priority}
        onChange={(e) => {
          set({ priority: e.target.value as TaskFilters["priority"] });
        }}
        aria-label="Filtrar por prioridad"
        className={controlCls}
      >
        <option value="todas">Toda prioridad</option>
        {PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>
            {TASK_PRIORITY_LABELS[priority]}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-1.5">
        <Users className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <select
          value={filters.teamId ?? ""}
          onChange={(e) => {
            set({ teamId: e.target.value || null });
          }}
          aria-label="Filtrar por equipo"
          className={controlCls}
        >
          <option value="">Todos los equipos</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </label>

      <select
        value={filters.assigneeId ?? ""}
        onChange={(e) => {
          set({ assigneeId: e.target.value || null });
        }}
        aria-label="Filtrar por responsable"
        className={controlCls}
      >
        <option value="">Cualquier responsable</option>
        <option value={UNASSIGNED}>Sin repartir</option>
        {members.map((member) => (
          <option key={member.user_id} value={member.user_id}>
            {member.name} {member.last_name}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-1.5">
        <FolderTree className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <select
          value={filters.locationId ?? ""}
          onChange={(e) => {
            set({ locationId: e.target.value || null });
          }}
          aria-label="Filtrar por ubicación en la estructura"
          className={cn(controlCls, "max-w-[12rem]")}
          disabled={locations.length === 0}
        >
          <option value="">Toda la estructura</option>
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {"— ".repeat(location.depth)}
              {location.label}
            </option>
          ))}
        </select>
      </label>

      {/* Lapso de tiempo: se filtra por solape con el intervalo de la tarea,
          así que basta con marcar el mes que interesa mirar. */}
      <label className="flex items-center gap-1.5">
        <CalendarRange className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          type="date"
          value={filters.from ?? ""}
          onChange={(e) => {
            set({ from: e.target.value || null });
          }}
          aria-label="Desde"
          className={cn(controlCls, "w-[8.5rem]")}
        />
        <span className="text-xs text-muted-foreground">a</span>
        <input
          type="date"
          value={filters.to ?? ""}
          onChange={(e) => {
            set({ to: e.target.value || null });
          }}
          aria-label="Hasta"
          className={cn(controlCls, "w-[8.5rem]")}
        />
      </label>

      {active > 0 && (
        <button
          type="button"
          onClick={() => {
            dispatch({ type: "reset" });
          }}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
          Limpiar
          <span className="rounded-full bg-brand-gold/20 px-1.5 text-[10px] font-bold text-brand-gold-dark dark:text-brand-gold">
            {active}
          </span>
        </button>
      )}

      {active === 0 && (
        <span className="flex h-9 items-center gap-1.5 text-xs text-muted-foreground">
          <SlidersHorizontal className="size-3.5" aria-hidden />
          Sin filtros
        </span>
      )}
    </div>
  );
}
