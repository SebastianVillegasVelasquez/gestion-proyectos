import { AlertTriangle, RotateCcw, type LucideIcon } from "lucide-react";

// Los tres estados que toda pantalla atraviesa: cargando, sin datos, con error.
// Todo en tokens (`muted`, `border`, `brand-red`…), sin `slate-*` ni variantes
// `dark:` a mano: el modo oscuro lo resuelven las variables de App.css, así que
// no hay dos paletas que mantener en paralelo ni riesgo de que una se desvíe.

/** Esqueletos de carga reutilizables (placeholders animados). */
export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-muted-foreground/15" />
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
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-brand-red/30 bg-brand-red-light p-6 text-center"
    >
      <AlertTriangle className="size-7 text-brand-red" />
      <div>
        <p className="text-sm font-semibold text-brand-red-dark">{title}</p>
        <p className="mt-0.5 text-xs text-brand-red-dark/80">{hint}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 rounded-lg bg-card px-3 py-1.5 text-xs font-medium text-brand-red shadow-sm transition hover:bg-accent"
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
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </div>
      <div className="max-w-sm">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
