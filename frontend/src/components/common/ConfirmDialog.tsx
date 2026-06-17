import { AlertTriangle, X } from "lucide-react";

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Estilo destructivo (rojo) para acciones irreversibles. */
  destructive?: boolean;
  loading?: boolean;
  /** Mensaje de error a mostrar si la acción falló (claro y específico). */
  errorMessage?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

// Diálogo de confirmación reutilizable para acciones sensibles (ej. eliminar).
// Evita acciones accidentales y centraliza el feedback de carga/error.
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  loading = false,
  errorMessage,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3 p-5">
          <div
            className={
              destructive
                ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-950/40"
                : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-500 dark:bg-blue-950/40"
            }
          >
            <AlertTriangle className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">{title}</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{message}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="size-4" />
          </button>
        </div>

        {errorMessage && (
          <p
            role="alert"
            className="mx-5 mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-400"
          >
            {errorMessage}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={
              destructive
                ? "rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                : "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            }
          >
            {loading ? "Procesando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
