import { Moon, Sun, Calendar, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import type { ProjectFormData } from "../types";

function formatDate(iso: string): string {
  if (!iso) {return "—";}
  const [year, month, day] = iso.split("-");
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
}

function getProgressColor(pct: number): string {
  if (pct >= 70) {return "bg-emerald-500";}
  if (pct >= 40) {return "bg-amber-400";}
  return "bg-blue-500";
}

function getProgressTextColor(pct: number): string {
  if (pct >= 70) {return "text-emerald-600 dark:text-emerald-400";}
  if (pct >= 40) {return "text-amber-600 dark:text-amber-400";}
  return "text-blue-600 dark:text-blue-400";
}

interface ProjectHeaderProps {
  project: ProjectFormData & { progress_pct?: number };
  dark: boolean;
  onToggleDark: () => void;
}

export function ProjectHeader({ project, dark, onToggleDark }: ProjectHeaderProps) {
  const navigate = useNavigate();
  const pct = project.progress_pct ?? 0;

  return (
    <div className="flex shrink-0 flex-col gap-4">
      {/* Top row: back + title + dark toggle */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => navigate("/projects")}
          aria-label="Volver a todos los proyectos"
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:text-white"
        >
          <ChevronLeft className="size-4" />
        </button>

        <div className="min-w-0 flex-1">
          <h1
            className={cn(
              "truncate text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl",
              !project.name && "italic opacity-50"
            )}
          >
            {project.name || "Proyecto sin nombre"}
          </h1>

          {(project.start_date || project.end_date) && (
            <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
              <Calendar className="size-3.5 shrink-0" />
              <span>
                {formatDate(project.start_date)}
                <span className="mx-2 text-slate-300 dark:text-slate-600">→</span>
                {formatDate(project.end_date)}
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleDark}
          aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white"
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Progreso global
          </span>
          <span className={cn("text-sm font-bold tabular-nums", getProgressTextColor(pct))}>
            {pct}%
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className={cn("h-full rounded-full transition-all duration-500", getProgressColor(pct))}
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>
    </div>
  );
}
