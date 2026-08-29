import { useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FolderKanban,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/common/AsyncStates";
import type { ApiTeamMember, ApiTeamTask } from "../api/workspace.api";
import type { Deliverable } from "../types";
import { STATUS_META, workloadByMember, workloadBarClass } from "../utils/team-tasks";
import { summarizeTeamProgress } from "../utils/team-progress";
import { TeamPerformanceChart } from "./TeamPerformanceChart";

function StatTile({
  Icon,
  label,
  value,
  tone,
}: {
  Icon: LucideIcon;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 dark:border-slate-800 dark:bg-slate-900">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tone)}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-semibold leading-tight tabular-nums text-slate-800 dark:text-slate-100">
          {value}
        </span>
        <span className="block truncate text-[11px] text-slate-400 dark:text-slate-500">
          {label}
        </span>
      </span>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

interface TeamProgressViewProps {
  tasks: ApiTeamTask[];
  deliverables: Deliverable[];
  teamMembers: ApiTeamMember[];
  today: string;
}

/**
 * Panorama del equipo: avance global, cuellos de botella y carga por persona.
 * Todo se deriva de las tareas y entregables ya cargados; no hace peticiones
 * nuevas.
 */
export function TeamProgressView({
  tasks,
  deliverables,
  teamMembers,
  today,
}: TeamProgressViewProps) {
  const s = useMemo(
    () => summarizeTeamProgress(tasks, deliverables, today),
    [tasks, deliverables, today],
  );
  const workload = useMemo(
    () =>
      workloadByMember(
        tasks,
        teamMembers.map((m) => m.user_id),
        today,
      ),
    [tasks, teamMembers, today],
  );
  const maxStatus = Math.max(1, ...s.byStatus.map((x) => x.count));

  if (s.totalTasks === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={FolderKanban}
          title="Aún no hay nada que medir"
          hint="Cuando el equipo tenga tareas delegadas, aquí verás su avance, los cuellos de botella y la carga por integrante."
        />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {/* Cifras de cabecera */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            Icon={CheckCircle2}
            label={`${String(s.completedTasks)} de ${String(s.totalTasks)} completadas`}
            value={`${String(s.completionPct)}%`}
            tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
          />
          <StatTile
            Icon={AlertTriangle}
            label="Tareas vencidas"
            value={String(s.overdueTasks)}
            tone="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
          />
          <StatTile
            Icon={Clock}
            label="Esperando revisión"
            value={String(s.awaitingReviewTasks)}
            tone="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
          />
          <StatTile
            Icon={Inbox}
            label="Entregables por revisar"
            value={String(s.deliverablesPendingReview)}
            tone="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
          />
        </div>

        {/* Rendimiento por integrante (barras con filtro de métrica) */}
        {teamMembers.length > 0 && (
          <SectionCard title="Rendimiento por integrante">
            <TeamPerformanceChart tasks={tasks} teamMembers={teamMembers} today={today} />
          </SectionCard>
        )}

        {/* Tareas por estado */}
        <SectionCard title="Tareas por estado">
          <div className="flex flex-col gap-2.5">
            {s.byStatus.map((slice) => (
              <div key={slice.status} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-[12px] text-slate-500 dark:text-slate-400">
                  {STATUS_META[slice.status].label}
                </span>
                <div className="flex h-2.5 flex-1 items-center overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={cn("h-full rounded-full", STATUS_META[slice.status].bar)}
                    style={{ width: `${String((slice.count / maxStatus) * 100)}%` }}
                  />
                </div>
                <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                  {slice.count} · {slice.pct}%
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Carga por integrante */}
        {teamMembers.length > 0 && (
          <SectionCard title="Carga por integrante (tareas abiertas)">
            <div className="flex flex-col gap-2.5">
              {teamMembers.map((m) => {
                const w = workload[m.user_id];
                const name = `${m.name} ${m.last_name}`.trim();
                return (
                  <div key={m.user_id} className="flex items-center gap-3">
                    <span
                      className="w-32 shrink-0 truncate text-[12px] text-slate-600 dark:text-slate-300"
                      title={name}
                    >
                      {name}
                    </span>
                    <div className="flex h-2.5 flex-1 items-center overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={cn("h-full rounded-full", workloadBarClass(w.pct))}
                        style={{ width: `${String(w.pct)}%` }}
                      />
                    </div>
                    <span className="w-20 shrink-0 text-right text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                      {w.openTasks} abierta{w.openTasks === 1 ? "" : "s"}
                      {w.overdueTasks > 0 && (
                        <span className="ml-1 font-semibold text-rose-500">
                          · {w.overdueTasks} venc.
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}

        {/* Entregables */}
        {s.deliverablesTotal > 0 && (
          <SectionCard title="Entregables">
            <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-[12px] text-slate-500 dark:text-slate-400">
              <span>
                <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                  {s.deliverablesTotal}
                </span>{" "}
                en total
              </span>
              <span>
                <span className="font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                  {s.deliverablesPendingReview}
                </span>{" "}
                por revisar
              </span>
              <span>
                <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {s.deliverablesApproved}
                </span>{" "}
                aprobados
              </span>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
