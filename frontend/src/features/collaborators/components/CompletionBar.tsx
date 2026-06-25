import { cn } from "@/lib/utils";
import { completionTone } from "../utils/completion";

// Barra de progreso de tareas completadas. Presentacional: el color lo decide
// la función pura `completionTone` según el porcentaje.
export function CompletionBar({
  pct,
  completed,
  assigned,
  showFraction = true,
}: {
  pct: number;
  completed: number;
  assigned: number;
  showFraction?: boolean;
}) {
  const tone = completionTone(pct);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={cn("font-semibold", tone.text)}>{pct}%</span>
        {showFraction && (
          <span className="text-slate-400 dark:text-slate-500">
            {completed}/{assigned} tareas
          </span>
        )}
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn("h-full rounded-full transition-all", tone.bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
