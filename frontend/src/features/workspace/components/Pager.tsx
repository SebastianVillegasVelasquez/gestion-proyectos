import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PagerProps {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  /** Texto a la izquierda del pager (ej. "12 de 40 entregables"). */
  summary?: string;
  className?: string;
}

/**
 * Pager compacto (anterior / «n / total» / siguiente). Presentacional: el
 * estado vive en `useClientPagination`. Se oculta entero cuando hay una sola
 * página y no se pasa `summary`.
 */
export function Pager({ page, totalPages, onPrev, onNext, summary, className }: PagerProps) {
  if (totalPages <= 1 && !summary) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 text-[11px] text-slate-400 dark:text-slate-500",
        className,
      )}
    >
      {summary ? <span className="truncate">{summary}</span> : <span />}
      {totalPages > 1 && (
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            aria-label="Página anterior"
            onClick={onPrev}
            className="flex size-7 items-center justify-center rounded-md border border-slate-200 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            aria-label="Página siguiente"
            onClick={onNext}
            className="flex size-7 items-center justify-center rounded-md border border-slate-200 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
