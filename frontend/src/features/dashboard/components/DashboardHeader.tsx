import { Moon, Sun } from "lucide-react";
import type { DashboardHeaderData } from "../types";
import { greetingForHour } from "../utils/greeting";

interface DashboardHeaderProps extends DashboardHeaderData {
  dark: boolean;
  onToggleDark: () => void;
}

export function DashboardHeader({
  name,
  date,
  tasksToday,
  tasksTodayTotal,
  dark,
  onToggleDark,
}: DashboardHeaderProps) {
  const progressPercent = Math.round((tasksToday / tasksTodayTotal) * 100);
  const greeting = greetingForHour(new Date().getHours());

  return (
    <div className="flex shrink-0 items-center justify-between gap-4">
      {/* Greeting */}
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
          {greeting}, <span className="text-brand-gold-dark dark:text-brand-gold">{name}</span>
        </h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{date}</p>
      </div>

      {/* Right side: progress pill + dark toggle */}
      <div className="flex shrink-0 items-center gap-3">
        {/* Hoy X/Y progress pill */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Hoy
            </span>
            <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">
              {tasksToday}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              / {tasksTodayTotal}
            </span>
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
