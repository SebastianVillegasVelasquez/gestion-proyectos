import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Briefcase,
  CheckCircle2,
  ClipboardList,
  FolderKanban,
  History,
  Loader2,
  Mail,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSkeleton, ErrorState, EmptyState } from "@/components/common/AsyncStates";
import {
  TASK_STATUS_COLORS,
  TASK_STATUS_LABELS,
  positionLabel,
} from "@/features/projects/types/labels";
import { useCollaboratorActivity } from "../hooks/use-collaborators";
import { HISTORY_ACTION_LABELS, personInitials } from "../utils/completion";
import { MOCK_ACTIVITY } from "../utils/activity-mock";
import type { CollaboratorActivity } from "../types";
import { CompletionBar } from "./CompletionBar";

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const [date] = iso.split("T");
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Briefcase;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", tone)}>
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-xl font-semibold text-slate-900 dark:text-slate-50">{value}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityContent({
  activity,
  onPreview,
}: {
  activity: CollaboratorActivity;
  onPreview?: () => void;
}) {
  return (
    <>
      {/* Identidad */}
      <div className="flex shrink-0 items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-lg font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
          {personInitials(activity.name, activity.last_name)}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {activity.name} {activity.last_name}
          </h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Briefcase className="size-3.5" /> {positionLabel(activity.position)}
            </span>
            <span className="flex items-center gap-1">
              <Mail className="size-3.5" /> {activity.email}
            </span>
          </p>
        </div>
      </div>

      {/* Progreso general */}
      <Card className="shrink-0">
        <CardContent className="py-4">
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            Avance de tareas asignadas
          </p>
          <CompletionBar
            pct={activity.completion_pct}
            completed={activity.completed_tasks}
            assigned={activity.assigned_tasks}
          />
        </CardContent>
      </Card>

      {/* Métricas */}
      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          icon={ClipboardList}
          label="Asignadas"
          value={activity.assigned_tasks}
          tone="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
        />
        <StatCard
          icon={CheckCircle2}
          label="Completadas"
          value={activity.completed_tasks}
          tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300"
        />
        <StatCard
          icon={Loader2}
          label="En progreso"
          value={activity.in_progress_tasks}
          tone="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300"
        />
        <StatCard
          icon={FolderKanban}
          label="Proyectos"
          value={activity.project_count}
          tone="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300"
        />
        <StatCard
          icon={UsersRound}
          label="Equipos"
          value={activity.team_count}
          tone="bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300"
        />
      </div>

      {/* Tareas + Historial */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Tareas asignadas */}
        <section className="flex min-h-0 flex-col">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <ClipboardList className="size-4 text-blue-500" /> Tareas asignadas
            <span className="rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-500 dark:bg-slate-800">
              {activity.tasks.length}
            </span>
          </h2>
          {activity.tasks.length === 0 ? (
            <p className="text-sm italic text-slate-400">Sin tareas asignadas.</p>
          ) : (
            <div className="flex min-h-0 flex-col gap-2 overflow-y-auto pr-1">
              {activity.tasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
                    {t.title}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                      TASK_STATUS_COLORS[t.status],
                    )}
                  >
                    {TASK_STATUS_LABELS[t.status]}
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-400">
                    {formatDate(t.due_date)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Historial (TaskHistory) */}
        <section className="flex min-h-0 flex-col">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <History className="size-4 text-slate-400" /> Historial de actividad
            <span className="rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-500 dark:bg-slate-800">
              {activity.history.length}
            </span>
          </h2>
          {activity.history.length === 0 ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm italic text-slate-400">Sin actividad registrada.</p>
              {onPreview && (
                <button
                  type="button"
                  onClick={onPreview}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/25"
                >
                  <Sparkles className="size-3.5" /> Ver datos de ejemplo
                </button>
              )}
            </div>
          ) : (
            <ol className="flex min-h-0 flex-col gap-2 overflow-y-auto pr-1">
              {activity.history.map((h) => (
                <li
                  key={h.id}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                      {HISTORY_ACTION_LABELS[h.action]}
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {formatDate(h.created_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                    {h.task_title}
                  </p>
                  {h.old_status && h.new_status && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
                        {TASK_STATUS_LABELS[h.old_status]}
                      </span>
                      →
                      <span
                        className={cn("rounded px-1.5 py-0.5", TASK_STATUS_COLORS[h.new_status])}
                      >
                        {TASK_STATUS_LABELS[h.new_status]}
                      </span>
                    </p>
                  )}
                  {h.change_reason && (
                    <p className="mt-1 text-[11px] italic text-slate-400">“{h.change_reason}”</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}

export function CollaboratorActivityPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const query = useCollaboratorActivity(userId);
  // Vista previa con datos de ejemplo (no reales) para mostrar la trazabilidad
  // del colaborador antes de que haya historial real en la base de datos.
  const [preview, setPreview] = useState(false);

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4 sm:p-5">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => void navigate("/collaborators")}
          className="text-xs text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
        >
          ← Colaboradores
        </button>
        <button
          type="button"
          onClick={() => {
            setPreview((p) => !p);
          }}
          aria-pressed={preview}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium transition-colors",
            preview
              ? "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300"
              : "border-slate-200 text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
          )}
        >
          <Sparkles className="size-3.5" /> Datos de ejemplo
        </button>
      </div>

      {preview && (
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <Sparkles className="size-4 shrink-0" />
          <span className="flex-1">
            Estás viendo <strong>datos de ejemplo</strong> (no reales) de la trazabilidad del
            colaborador.
          </span>
          <button
            type="button"
            onClick={() => {
              setPreview(false);
            }}
            className="shrink-0 font-medium underline-offset-2 hover:underline"
          >
            Salir del ejemplo
          </button>
        </div>
      )}

      {preview ? (
        <ActivityContent activity={MOCK_ACTIVITY} />
      ) : query.isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : query.isError ? (
        <ErrorState
          title="No se pudo cargar la actividad"
          hint="Es posible que el colaborador no exista o no tengas acceso."
          onRetry={() => void query.refetch()}
        />
      ) : !query.data ? (
        <EmptyState icon={UsersRound} title="Colaborador no encontrado" />
      ) : (
        <ActivityContent
          activity={query.data}
          onPreview={() => {
            setPreview(true);
          }}
        />
      )}
    </div>
  );
}
