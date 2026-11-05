import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { Plus, ShieldAlert } from "lucide-react";
import { ErrorState, LoadingSkeleton } from "@/components/common/AsyncStates";
import { cn } from "@/lib/utils";
import { ProjectSectionShell } from "../../components/detail/ProjectSectionShell";
import { useProject } from "../../hooks/use-projects";
import { useProjectIncidents } from "../use-incidents";
import type { ProjectIncident } from "../types";
import { pluralDays, summarizeIncidents } from "../utils";
import { IncidentCard } from "./IncidentCard";
import { IncidentFormModal } from "./IncidentFormModal";
import { PendingDelayButton } from "./PendingDelayButton";

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border border-border bg-card px-4 py-3">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={cn("text-2xl font-semibold tabular-nums text-foreground", tone)}>
        {value}
      </span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

/**
 * Bitácora de incidentes contractuales del proyecto: qué pasó, de quién fue,
 * cuántos días atrasó y cuánto tardó el cliente en responder. Registrar un
 * incidente no mueve el cronograma; eso se confirma aparte, manteniendo
 * presionado el botón de reflejar.
 */
export function ProjectIncidentsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const id = projectId ?? "";
  const { data: project } = useProject(id);
  const incidentsQuery = useProjectIncidents(id);
  const [form, setForm] = useState<{ incident?: ProjectIncident } | null>(null);

  const incidents = useMemo(() => incidentsQuery.data ?? [], [incidentsQuery.data]);
  const summary = useMemo(() => summarizeIncidents(incidents), [incidents]);

  return (
    <ProjectSectionShell
      projectId={id}
      title="Incidentes"
      icon={ShieldAlert}
      accentClass="bg-brand-gold/10 text-brand-gold-dark dark:text-brand-gold"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pb-2 pr-1">
        <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Incidentes" value={String(summary.total)} />
          <Stat
            label="Días de impacto"
            value={String(summary.impactDays)}
            hint={`${pluralDays(summary.appliedDays)} ya reflejados`}
          />
          <Stat
            label="Pendientes de reflejar"
            value={String(summary.pendingDays)}
            hint={
              summary.pendingCount > 0 ? `${String(summary.pendingCount)} incidente(s)` : undefined
            }
            tone={summary.pendingDays > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
          />
          <Stat
            label="Respuesta del cliente"
            value={
              summary.avgClientResponseDays === null
                ? "—"
                : `${String(summary.avgClientResponseDays)} d`
            }
            hint="promedio de espera"
          />
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-sm text-muted-foreground">
            Registrar un incidente no cambia las fechas del proyecto. Cuando quieras sumar el atraso
            al cronograma, mantén presionado el botón de reflejar.
          </p>
          <div className="flex flex-wrap items-start gap-2">
            <PendingDelayButton projectId={id} endDate={project?.end_date ?? null} />
            <button
              type="button"
              onClick={() => {
                setForm({});
              }}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-brand-gold-dark max-lg:min-h-[44px]"
            >
              <Plus className="size-4" /> Registrar incidente
            </button>
          </div>
        </div>

        {incidentsQuery.isLoading ? (
          <LoadingSkeleton rows={3} />
        ) : incidentsQuery.isError ? (
          <ErrorState
            title="No se pudo cargar la bitácora"
            onRetry={() => void incidentsQuery.refetch()}
          />
        ) : incidents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-accent/20 px-4 py-10 text-center">
            <ShieldAlert className="size-7 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Aún no hay incidentes</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Documenta aquí lo que frene o afecte al proyecto —con su fecha, evidencia y los días
              de atraso— para tener un respaldo contractual.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {incidents.map((incident) => (
              <IncidentCard
                key={incident.id}
                projectId={id}
                incident={incident}
                onEdit={(selected) => {
                  setForm({ incident: selected });
                }}
              />
            ))}
          </ul>
        )}
      </div>

      {form && (
        <IncidentFormModal
          projectId={id}
          incident={form.incident}
          onClose={() => {
            setForm(null);
          }}
        />
      )}
    </ProjectSectionShell>
  );
}
