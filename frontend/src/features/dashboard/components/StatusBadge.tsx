import { cn } from "@/lib/utils";
import type { Priority, ProjectStatus, TaskStatus } from "../types";

type BadgeVariant = ProjectStatus | Priority | TaskStatus;

interface BadgeConfig {
  label: string;
  /** Light-mode classes first, dark: overrides appended */
  classes: string;
}

const variantMap: Record<BadgeVariant, BadgeConfig> = {
  // Project status
  active: {
    label: "Activo",
    classes:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800",
  },
  "at-risk": {
    label: "En riesgo",
    classes:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
  },
  "in-review": {
    label: "En revisión",
    classes:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
  },
  // Priority
  today: {
    label: "Hoy",
    classes:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
  },
  high: {
    label: "Alta",
    classes:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800",
  },
  medium: {
    label: "Media",
    classes:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
  },
  low: {
    label: "Baja",
    classes:
      "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
  },
  // Task status
  pending: {
    label: "Pendiente",
    classes:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
  },
  "in-progress": {
    label: "En progreso",
    classes:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
  },
  completed: {
    label: "Completado",
    classes:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800",
  },
};

interface StatusBadgeProps {
  variant: BadgeVariant;
  className?: string;
  overrideLabel?: string;
}

export function StatusBadge({ variant, className, overrideLabel }: StatusBadgeProps) {
  const config = variantMap[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium leading-none",
        config.classes,
        className
      )}
    >
      {overrideLabel ?? config.label}
    </span>
  );
}
