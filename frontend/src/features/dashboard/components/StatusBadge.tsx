import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { Priority, ProjectStatus, TaskStatus } from "../types";

type BadgeVariant = ProjectStatus | Priority | TaskStatus;

/**
 * Estilos de estado como variantes CVA, alineados a la marca Bitácora OBJ:
 *  - info / en progreso → teal
 *  - éxito / completado  → verde
 *  - riesgo / alta       → rojo de marca
 *  - pendiente / baja    → gris neutro
 *  - revisión / media    → ámbar
 * Cada variante incluye overrides dark: para mantener contraste WCAG AA.
 */
const statusBadge = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium leading-none",
  {
    variants: {
      variant: {
        // Project status
        active:
          "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800",
        "at-risk":
          "bg-brand-red-light text-brand-red-dark border-brand-red/30 dark:text-brand-red dark:border-brand-red/40",
        "in-review":
          "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
        // Priority
        today:
          "bg-brand-teal-light text-brand-teal-dark border-brand-teal/30 dark:text-brand-teal dark:border-brand-teal/40",
        high: "bg-brand-red-light text-brand-red-dark border-brand-red/30 dark:text-brand-red dark:border-brand-red/40",
        medium:
          "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800",
        low: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
        // Task status
        pending:
          "bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
        "in-progress":
          "bg-brand-teal-light text-brand-teal-dark border-brand-teal/30 dark:text-brand-teal dark:border-brand-teal/40",
        completed:
          "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800",
      } satisfies Record<BadgeVariant, string>,
    },
    defaultVariants: { variant: "pending" },
  },
);

const LABELS: Record<BadgeVariant, string> = {
  active: "Activo",
  "at-risk": "En riesgo",
  "in-review": "En revisión",
  today: "Hoy",
  high: "Alta",
  medium: "Media",
  low: "Baja",
  pending: "Pendiente",
  "in-progress": "En progreso",
  completed: "Completado",
};

interface StatusBadgeProps extends VariantProps<typeof statusBadge> {
  variant: BadgeVariant;
  className?: string;
  overrideLabel?: string;
}

export function StatusBadge({ variant, className, overrideLabel }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadge({ variant }), className)}>
      {overrideLabel ?? LABELS[variant]}
    </span>
  );
}
