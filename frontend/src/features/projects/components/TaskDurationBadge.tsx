import { Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";
import { durationBucket, fmtDays } from "../utils/task-duration";

/**
 * Pastilla de color para los DÍAS ESTIMADOS de una tarea (ver `task-duration`).
 * `days` acepta number o string (el campo del formulario) y no pinta nada si no
 * hay una estimación válida.
 */
export function TaskDurationBadge({
  days,
  className,
}: {
  days: number | string | null | undefined;
  className?: string;
}) {
  const n = days == null || days === "" ? null : Number(days);
  if (n == null || Number.isNaN(n) || n <= 0) {
    return null;
  }
  const bucket = durationBucket(n);
  const text = fmtDays(n);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        bucket.cls,
        className,
      )}
      title={`Estimado: ${text} día${n === 1 ? "" : "s"} · duración ${bucket.label}`}
    >
      <Hourglass className="size-2.5" />
      {text} d
    </span>
  );
}
