import { useMemo } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/features/projects/types/labels";
import { useProjectMembers } from "@/features/projects/hooks/use-members";
import { useTeams } from "@/features/projects/hooks/use-teams";
import { useWorkTree } from "@/features/projects/hooks/use-structure";
import type { TaskPriority, TaskStatus } from "@/features/projects/types/api.types";
import type { AnalyticsFilters as Filters } from "../api/analytics.api";
import { PERIOD_PRESETS, activePreset } from "../utils/period-presets";
import { flattenStructure } from "../utils/structure-options";
import { StructurePicker } from "./StructurePicker";

const FIELD =
  "h-11 w-full rounded-xl border border-border bg-background px-3 text-[15px] text-foreground outline-none transition-colors hover:border-brand-gold/60 focus:border-brand-gold";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand-gold-light px-2.5 py-1 text-xs font-medium text-brand-gold-dark dark:bg-brand-gold/15 dark:text-brand-gold">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Quitar filtro: ${label}`}
        className="rounded-full p-0.5 hover:bg-brand-gold/20"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

/**
 * Filtros del informe. Pensados para proyectos con muchísimos elementos:
 * atajos de periodo, la estructura se elige con un buscador (no con una lista
 * interminable) y cada filtro activo queda a la vista como una pastilla que se
 * quita con un clic.
 */
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
  const structure = useMemo(() => flattenStructure(tree.data ?? []), [tree.data]);

  const set = (patch: Partial<Filters>) => {
    onChange({ ...value, ...patch });
  };
  const clear = (...keys: (keyof Filters)[]) => {
    onChange(
      Object.fromEntries(Object.entries(value).filter(([k]) => !(keys as string[]).includes(k))),
    );
  };

  const today = useMemo(() => new Date(), []);
  const preset = activePreset(value.date_from, value.date_to, today);

  const teamName = (teams.data?.items ?? []).find((t) => t.id === value.team_id)?.name;
  const person = (members.data ?? []).find((m) => m.user_id === value.assignee_id);
  const element = structure.find((o) => o.id === value.work_item_id);

  const chips: { key: string; label: string; remove: () => void }[] = [];
  if (value.date_from || value.date_to) {
    chips.push({
      key: "period",
      label: `Periodo: ${value.date_from ?? "…"} → ${value.date_to ?? "…"}`,
      remove: () => {
        clear("date_from", "date_to");
      },
    });
  }
  if (value.team_id) {
    chips.push({
      key: "team",
      label: `Equipo: ${teamName ?? "…"}`,
      remove: () => {
        clear("team_id");
      },
    });
  }
  if (value.assignee_id) {
    chips.push({
      key: "person",
      label: `Persona: ${person ? `${person.name} ${person.last_name}` : "…"}`,
      remove: () => {
        clear("assignee_id");
      },
    });
  }
  if (value.status_filter) {
    chips.push({
      key: "status",
      label: `Estado: ${TASK_STATUS_LABELS[value.status_filter as TaskStatus]}`,
      remove: () => {
        clear("status_filter");
      },
    });
  }
  if (value.priority) {
    chips.push({
      key: "priority",
      label: `Prioridad: ${TASK_PRIORITY_LABELS[value.priority as TaskPriority]}`,
      remove: () => {
        clear("priority");
      },
    });
  }
  if (value.work_item_id) {
    chips.push({
      key: "element",
      label: `Estructura: ${element?.name ?? "…"}`,
      remove: () => {
        clear("work_item_id");
      },
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Periodo rápido
        </span>
        {PERIOD_PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={preset === p.key}
            onClick={() => {
              const r = p.range(today);
              set({ date_from: r.from, date_to: r.to });
            }}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              preset === p.key
                ? "border-brand-gold bg-brand-gold-light text-brand-gold-dark dark:bg-brand-gold/15 dark:text-brand-gold"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
        <span
          className="text-[11px] text-muted-foreground"
          title="El periodo filtra por la fecha límite de las tareas"
        >
          · por fecha límite
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Field label="Desde" htmlFor="flt-from">
          <input
            id="flt-from"
            type="date"
            value={value.date_from ?? ""}
            onChange={(e) => {
              set({ date_from: e.target.value || undefined });
            }}
            className={FIELD}
          />
        </Field>
        <Field label="Hasta" htmlFor="flt-to">
          <input
            id="flt-to"
            type="date"
            value={value.date_to ?? ""}
            onChange={(e) => {
              set({ date_to: e.target.value || undefined });
            }}
            className={FIELD}
          />
        </Field>
        <Field label="Equipo" htmlFor="flt-team">
          <select
            id="flt-team"
            value={value.team_id ?? ""}
            onChange={(e) => {
              set({ team_id: e.target.value || undefined });
            }}
            className={FIELD}
          >
            <option value="">Todos los equipos</option>
            {(teams.data?.items ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Persona" htmlFor="flt-person">
          <select
            id="flt-person"
            value={value.assignee_id ?? ""}
            onChange={(e) => {
              set({ assignee_id: e.target.value || undefined });
            }}
            className={FIELD}
          >
            <option value="">Todas las personas</option>
            {(members.data ?? []).map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name} {m.last_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Estado" htmlFor="flt-status">
          <select
            id="flt-status"
            value={value.status_filter ?? ""}
            onChange={(e) => {
              set({ status_filter: e.target.value || undefined });
            }}
            className={FIELD}
          >
            <option value="">Todos los estados</option>
            {Object.entries(TASK_STATUS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Prioridad" htmlFor="flt-priority">
          <select
            id="flt-priority"
            value={value.priority ?? ""}
            onChange={(e) => {
              set({ priority: e.target.value || undefined });
            }}
            className={FIELD}
          >
            <option value="">Toda prioridad</option>
            {Object.entries(TASK_PRIORITY_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Estructura">
          <StructurePicker
            options={structure}
            value={value.work_item_id}
            loading={tree.isLoading}
            onChange={(id) => {
              set({ work_item_id: id });
            }}
          />
        </Field>
      </div>

      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Filtrando por
          </span>
          {chips.map((c) => (
            <ActiveChip key={c.key} label={c.label} onRemove={c.remove} />
          ))}
          <button
            type="button"
            onClick={() => {
              onChange({});
            }}
            className="ml-auto text-xs font-medium text-brand-teal-dark hover:underline dark:text-brand-teal"
          >
            Limpiar todo
          </button>
        </div>
      )}
    </section>
  );
}
