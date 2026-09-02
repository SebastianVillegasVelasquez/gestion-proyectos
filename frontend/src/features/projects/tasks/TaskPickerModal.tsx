import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TASK_STATUS_LABELS } from "../types/labels";
import type { Task } from "../types/api.types";

interface Props {
  tasks: Task[];
  /** Tarea ya elegida como dependencia (para marcarla), o "". */
  selectedId: string;
  onSelect: (taskId: string) => void;
  onClose: () => void;
}

/**
 * Buscador de tareas del proyecto para elegir una dependencia cuando no está
 * entre las "cercanas" (mismo elemento / hermanas). Solo busca y elige: la
 * regla de ciclos y de proyectos distintos la valida el backend.
 */
export function TaskPickerModal({ tasks, selectedId, onSelect, onClose }: Props) {
  const [search, setSearch] = useState("");

  const needle = search.trim().toLowerCase();
  const rows = useMemo(() => {
    const list = needle ? tasks.filter((t) => t.title.toLowerCase().includes(needle)) : tasks;
    return [...list].sort((a, b) => a.title.localeCompare(b.title)).slice(0, 200);
  }, [tasks, needle]);

  const choose = (taskId: string) => {
    onSelect(taskId);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Buscar una tarea del proyecto"
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      <div className="relative flex h-[70vh] w-full max-w-xl flex-col rounded-2xl border border-border bg-card shadow-2xl">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">
            Depende de otra tarea del proyecto
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="shrink-0 border-b border-border px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              autoFocus
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              placeholder="Buscar una tarea…"
              className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand-teal"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {rows.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Ninguna tarea coincide con la búsqueda.
            </p>
          ) : (
            <ul>
              {rows.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      choose(t.id);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      t.id === selectedId
                        ? "bg-brand-teal/10 ring-1 ring-brand-teal"
                        : "hover:bg-accent",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-foreground">{t.title}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {TASK_STATUS_LABELS[t.status]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selectedId && (
          <footer className="flex shrink-0 justify-end border-t border-border px-5 py-3">
            <button
              type="button"
              onClick={() => {
                choose("");
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Quitar dependencia
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
