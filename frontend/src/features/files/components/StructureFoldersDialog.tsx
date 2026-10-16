import { useState } from "react";
import { FolderTree, X } from "lucide-react";
import { getErrorMessage } from "@/utils/get-error-message";
import { useGenerateStructureFolders } from "../hooks/use-project-files";
import type { StructureFoldersResult } from "../api/files.api";

function summary(r: StructureFoldersResult): string {
  if (r.created === 0) {
    return "Las carpetas ya estaban al día: no hubo nada que crear.";
  }
  const parts = [`Se crearon ${String(r.created)} carpeta(s)`];
  if (r.existing > 0) {
    parts.push(`${String(r.existing)} ya existían`);
  }
  return `${parts.join(" y ")}.`;
}

/**
 * Genera en el archivador la jerarquía de carpetas de la estructura del
 * proyecto (padre → hijo → nieto). Todos los equipos la ven; las carpetas de
 * elementos que SON una tarea se omiten salvo que se marque la casilla.
 */
export function StructureFoldersDialog({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const generate = useGenerateStructureFolders(projectId);
  const [includeTasks, setIncludeTasks] = useState(false);
  const [result, setResult] = useState<StructureFoldersResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    generate.mutate(includeTasks, {
      onSuccess: setResult,
      onError: (e) => {
        setError(getErrorMessage(e, "No se pudieron generar las carpetas."));
      },
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Generar carpetas de la estructura"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
              <FolderTree className="size-4 text-brand-gold-dark" /> Carpetas de la estructura
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Crea una carpeta por cada elemento respetando su jerarquía (padre → hijo → nieto).
              Todos los equipos del proyecto las verán y podrán entregar en ellas.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>

        <label className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-accent/30 px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={includeTasks}
            disabled={generate.isPending || result !== null}
            onChange={(e) => {
              setIncludeTasks(e.target.checked);
            }}
            className="mt-0.5 size-4 accent-brand-gold"
          />
          <span>
            Crear también carpetas para los elementos de tipo tarea
            <span className="block text-[11px] text-muted-foreground">
              Desmarcado por defecto: una tarea rara vez necesita su propia carpeta.
            </span>
          </span>
        </label>

        {error && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-900/20 dark:text-rose-300">
            {error}
          </p>
        )}
        {result && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
            {summary(result)}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:bg-accent"
          >
            {result ? "Cerrar" : "Cancelar"}
          </button>
          {!result && (
            <button
              type="button"
              disabled={generate.isPending}
              onClick={submit}
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-brand-gold-dark disabled:opacity-50"
            >
              {generate.isPending ? "Generando…" : "Generar carpetas"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
