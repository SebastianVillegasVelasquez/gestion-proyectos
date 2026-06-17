import { AlertTriangle, RotateCcw, type LucideIcon } from "lucide-react";

/** Esqueletos de carga reutilizables (placeholders animados). */
export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      ))}
    </div>
  );
}

/** Mensaje de error claro y accionable, con reintento opcional. */
export function ErrorState({
  title = "No se pudo cargar la información",
  hint = "Revisa tu conexión e inténtalo de nuevo.",
  onRetry,
}: {
  title?: string;
  hint?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50/60 p-6 text-center dark:border-red-500/30 dark:bg-red-500/10"
    >
      <AlertTriangle className="size-7 text-red-500" />
      <div>
        <p className="text-sm font-semibold text-red-700 dark:text-red-300">{title}</p>
        <p className="mt-0.5 text-xs text-red-600/80 dark:text-red-400/80">{hint}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm transition hover:bg-red-50 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-slate-800"
        >
          <RotateCcw className="size-3.5" /> Reintentar
        </button>
      )}
    </div>
  );
}

/** Estado vacío consistente (sin datos todavía / sin resultados de búsqueda). */
export function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-700">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        <Icon className="size-6" />
      </div>
      <div className="max-w-sm">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
        {hint && <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}
