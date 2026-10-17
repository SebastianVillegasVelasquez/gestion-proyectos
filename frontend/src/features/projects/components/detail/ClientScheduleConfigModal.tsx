import { useMemo, useState } from "react";
import { CalendarClock, GanttChartSquare, Layers, ListTree, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkTree } from "../../hooks/use-structure";
import { useSaveClientScheduleConfig } from "../../hooks/use-projects";
import type { ClientAccessInfo, WorkItemTree } from "../../types/api.types";

interface Props {
  projectId: string;
  /** Alcance actual (del endpoint client-access): precarga los controles. */
  access: ClientAccessInfo;
  onClose: () => void;
}

/** Profundidad máxima del árbol (1 = solo raíces). */
function treeDepth(nodes: WorkItemTree[]): number {
  let max = 0;
  const walk = (list: WorkItemTree[], depth: number) => {
    for (const n of list) {
      max = Math.max(max, depth);
      if (n.children.length > 0) {
        walk(n.children, depth + 1);
      }
    }
  };
  walk(nodes, 1);
  return max;
}

/**
 * "Configurar cronograma del cliente": decide hasta qué profundidad de la
 * estructura se dibuja el Gantt del portal y si se incluyen las tareas y
 * subtareas de cada elemento. Lee la estructura real del proyecto para acotar
 * el selector de niveles y previsualizar el recorte. Guarda en el proyecto
 * (PATCH), de modo que afecta a lo que ve cualquiera con el enlace.
 */
export function ClientScheduleConfigModal({ projectId, access, onClose }: Props) {
  const treeQuery = useWorkTree(projectId);
  const save = useSaveClientScheduleConfig(projectId);

  // 0 = "todos los niveles"; N ≥ 1 = hasta esa profundidad.
  const [depth, setDepth] = useState(access.schedule_element_depth);
  const [includeTasks, setIncludeTasks] = useState(access.schedule_include_tasks);
  const [subtasksChecked, setSubtasksChecked] = useState(access.schedule_include_subtasks);
  // Sin tareas no hay subtareas que mostrar (el backend lo fuerza también).
  const includeSubtasks = includeTasks && subtasksChecked;

  const maxDepth = useMemo(() => treeDepth(treeQuery.data ?? []), [treeQuery.data]);
  const levels = useMemo(
    () => Array.from({ length: Math.max(maxDepth, 1) }, (_, i) => i + 1),
    [maxDepth],
  );
  // Nivel efectivo aplicado a la vista previa (0 → todos → maxDepth).
  const effectiveDepth = depth === 0 ? maxDepth : Math.min(depth, maxDepth);

  const dirty =
    depth !== access.schedule_element_depth ||
    includeTasks !== access.schedule_include_tasks ||
    includeSubtasks !== access.schedule_include_subtasks;

  const submit = () => {
    save.mutate(
      {
        element_depth: depth,
        include_tasks: includeTasks,
        include_subtasks: includeSubtasks,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <header className="flex items-start justify-between border-b border-border px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue">
              <GanttChartSquare className="size-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Configurar cronograma del cliente
              </h3>
              <p className="text-xs text-muted-foreground">
                Hasta qué nivel de la estructura ve el cliente el Gantt.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex flex-col gap-5 overflow-y-auto px-5 py-4">
          {/* ── Profundidad de elementos ─────────────────────────────────── */}
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Layers className="size-3.5" /> Profundidad de elementos
            </span>
            {treeQuery.isLoading ? (
              <div className="h-9 animate-pulse rounded-lg bg-muted" />
            ) : maxDepth === 0 ? (
              <p className="text-xs text-muted-foreground">
                El proyecto aún no tiene estructura. El cliente verá el cronograma completo cuando
                la haya.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {levels.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setDepth(n);
                      }}
                      aria-pressed={depth === n}
                      className={cn(
                        "min-w-9 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
                        depth === n
                          ? "border-brand-blue bg-brand-blue/10 text-brand-blue-dark dark:text-brand-blue"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Nivel {String(n)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setDepth(0);
                    }}
                    aria-pressed={depth === 0}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
                      depth === 0
                        ? "border-brand-blue bg-brand-blue/10 text-brand-blue-dark dark:text-brand-blue"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Todos
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {depth === 0
                    ? `Se muestran los ${String(maxDepth)} niveles de la estructura.`
                    : `Se muestran los elementos hasta el nivel ${String(
                        depth,
                      )}; lo que cuelgue más abajo se oculta.`}
                </p>
              </>
            )}
          </div>

          {/* ── Tareas y subtareas ───────────────────────────────────────── */}
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <ListTree className="size-3.5" /> Detalle
            </span>
            <label className="flex items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={includeTasks}
                onChange={(e) => {
                  setIncludeTasks(e.target.checked);
                }}
                className="mt-0.5 size-4 rounded border-border text-brand-blue focus:ring-brand-blue"
              />
              <span>
                <span className="font-medium text-foreground">
                  Incluir las tareas de cada elemento
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  Sin responsables ni equipos: solo el nombre, las fechas y el avance.
                </span>
              </span>
            </label>
            <label
              className={cn(
                "flex items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm",
                !includeTasks && "opacity-50",
              )}
            >
              <input
                type="checkbox"
                checked={includeSubtasks}
                disabled={!includeTasks}
                onChange={(e) => {
                  setSubtasksChecked(e.target.checked);
                }}
                className="mt-0.5 size-4 rounded border-border text-brand-blue focus:ring-brand-blue disabled:cursor-not-allowed"
              />
              <span>
                <span className="font-medium text-foreground">Incluir también las subtareas</span>
                <span className="block text-[11px] text-muted-foreground">
                  Un nivel más de detalle, colgando de su tarea.
                </span>
              </span>
            </label>
          </div>

          {/* ── Vista previa del recorte ─────────────────────────────────── */}
          {maxDepth > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Vista previa
              </span>
              <div className="max-h-52 overflow-auto rounded-lg border border-border bg-muted/50 p-3">
                <PreviewTree
                  nodes={treeQuery.data ?? []}
                  cutDepth={effectiveDepth}
                  includeTasks={includeTasks}
                  includeSubtasks={includeTasks && includeSubtasks}
                />
              </div>
            </div>
          )}

          <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
            <CalendarClock className="mt-px size-3.5 shrink-0" />
            Los elementos sin fecha de fin toman la fecha de fin del proyecto, para que aparezcan
            igual dentro del Gantt.
          </p>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!dirty || save.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-gold-dark disabled:opacity-50"
          >
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </button>
        </footer>
      </div>
    </div>
  );
}

/** Árbol compacto que atenúa lo que quedará fuera del cronograma del cliente. */
function PreviewTree({
  nodes,
  cutDepth,
  includeTasks,
  includeSubtasks,
  depth = 1,
}: {
  nodes: WorkItemTree[];
  cutDepth: number;
  includeTasks: boolean;
  includeSubtasks: boolean;
  depth?: number;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {nodes.map((n) => {
        const hidden = depth > cutDepth;
        return (
          <li key={n.id}>
            <div
              className={cn(
                "flex items-center gap-1.5 text-xs",
                hidden ? "text-muted-foreground/60 line-through" : "text-muted-foreground",
              )}
              style={{ paddingLeft: (depth - 1) * 14 }}
            >
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  hidden ? "bg-muted-foreground/30" : "bg-brand-blue",
                )}
              />
              {n.nombre}
            </div>
            {n.children.length > 0 && (
              <PreviewTree
                nodes={n.children}
                cutDepth={cutDepth}
                includeTasks={includeTasks}
                includeSubtasks={includeSubtasks}
                depth={depth + 1}
              />
            )}
            {/* Marcador de que, además, colgarán tareas (y subtareas) de este
                elemento cuando esté dentro del corte. */}
            {includeTasks && !n.children.length && depth <= cutDepth && (
              <div
                className="flex items-center gap-1.5 text-[11px] italic text-muted-foreground"
                style={{ paddingLeft: depth * 14 }}
              >
                <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/30" />
                tareas{includeSubtasks ? "y subtareas" : ""} del elemento
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default ClientScheduleConfigModal;
