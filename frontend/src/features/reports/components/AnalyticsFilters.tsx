import { useMemo } from "react";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/features/projects/types/labels";
import { parentLocationOptions } from "@/features/projects/tasks/task-filters";
import { useProjectMembers } from "@/features/projects/hooks/use-members";
import { useTeams } from "@/features/projects/hooks/use-teams";
import { useWorkTree } from "@/features/projects/hooks/use-structure";
import type { AnalyticsFilters as Filters } from "../api/analytics.api";

const sel =
  "h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground outline-none focus:border-brand-gold";

export function AnalyticsFilters({
  projectId,
  value,
  onChange,
}: {
  projectId: string;
  value: Filters;
  onChange: (next: Filters) => void;
}) {
  const teams = useTeams(projectId);
  const members = useProjectMembers(projectId);
  const tree = useWorkTree(projectId);
  const locations = useMemo(() => parentLocationOptions(tree.data ?? []), [tree.data]);

  const set = (patch: Partial<Filters>) => {
    onChange({ ...value, ...patch });
  };
  const hasAny = Object.values(value).some((v) => v != null && v !== "");

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2.5">
      <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
        Desde
        <input
          type="date"
          value={value.date_from ?? ""}
          onChange={(e) => {
            set({ date_from: e.target.value || undefined });
          }}
          className={sel}
        />
      </label>
      <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
        Hasta
        <input
          type="date"
          value={value.date_to ?? ""}
          onChange={(e) => {
            set({ date_to: e.target.value || undefined });
          }}
          className={sel}
        />
      </label>

      <select
        aria-label="Equipo"
        value={value.team_id ?? ""}
        onChange={(e) => {
          set({ team_id: e.target.value || undefined });
        }}
        className={sel}
      >
        <option value="">Todos los equipos</option>
        {(teams.data?.items ?? []).map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      <select
        aria-label="Persona"
        value={value.assignee_id ?? ""}
        onChange={(e) => {
          set({ assignee_id: e.target.value || undefined });
        }}
        className={sel}
      >
        <option value="">Todas las personas</option>
        {(members.data ?? []).map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {m.name} {m.last_name}
          </option>
        ))}
      </select>

      <select
        aria-label="Estado"
        value={value.status_filter ?? ""}
        onChange={(e) => {
          set({ status_filter: e.target.value || undefined });
        }}
        className={sel}
      >
        <option value="">Todos los estados</option>
        {Object.entries(TASK_STATUS_LABELS).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>

      <select
        aria-label="Prioridad"
        value={value.priority ?? ""}
        onChange={(e) => {
          set({ priority: e.target.value || undefined });
        }}
        className={sel}
      >
        <option value="">Toda prioridad</option>
        {Object.entries(TASK_PRIORITY_LABELS).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>

      <select
        aria-label="Elemento de la estructura"
        value={value.work_item_id ?? ""}
        onChange={(e) => {
          set({ work_item_id: e.target.value || undefined });
        }}
        className={sel}
        disabled={locations.length === 0}
      >
        <option value="">Toda la estructura</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {"— ".repeat(l.depth)}
            {l.label}
          </option>
        ))}
      </select>

      {hasAny && (
        <button
          type="button"
          onClick={() => {
            onChange({});
          }}
          className="h-8 rounded-md px-2 text-[11px] font-medium text-brand-teal-dark hover:underline dark:text-brand-teal"
        >
          Limpiar
        </button>
      )}
    </div>
  );
}
