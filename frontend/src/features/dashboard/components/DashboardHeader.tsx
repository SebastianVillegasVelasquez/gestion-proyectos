import { Moon, Sun } from "lucide-react";
import { greetingForHour } from "../utils/greeting";

interface DashboardHeaderProps {
  name: string;
  date: string;
  /** Tareas completadas / totales (del resumen real). Sin datos → se oculta la píldora. */
  tasksCompleted?: number;
  tasksTotal?: number;
  dark: boolean;
  onToggleDark: () => void;
}

export function DashboardHeader({
  name,
  date,
  tasksCompleted,
  tasksTotal,
  dark,
  onToggleDark,
}: DashboardHeaderProps) {
  const greeting = greetingForHour(new Date().getHours());
  const hasProgress = tasksCompleted != null && tasksTotal != null && tasksTotal > 0;
  const progressPercent = hasProgress ? Math.round((tasksCompleted / tasksTotal) * 100) : 0;

  return (
    // Envuelve: en móvil el saludo, la píldora de progreso y el interruptor de
    // tema no caben en una línea y se comprimían hasta cortar el nombre.
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
      {/* Greeting */}
      <div className="min-w-[180px] flex-1">
        <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
          {greeting}, <span className="text-brand-gold-dark dark:text-brand-gold">{name}</span>
        </h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{date}</p>
      </div>

      {/* Right side: progreso real de tareas + dark toggle */}
      <div className="ml-auto flex shrink-0 items-center gap-3">
        {hasProgress && (
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Tareas
              </span>
              <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">
                {tasksCompleted}
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">/ {tasksTotal}</span>
            </div>
            <div
              className="w-28 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
              style={{ height: "3px" }}
            >
              <div
                className="h-full bg-brand-gold transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Dark mode toggle — matches Login.tsx button style */}
        <button
          type="button"
          onClick={onToggleDark}
          aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors duration-150 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </div>
    </div>
  );
}
