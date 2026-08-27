import { useMemo, useReducer, useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Moon,
  Plus,
  Send,
  Sun,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Role } from "@/features/auth/types";
import { useProject } from "../hooks/use-projects";
import { useProjectTasks } from "../hooks/use-tasks";
import { useProjectMembers } from "../hooks/use-members";
import { useTeams } from "../hooks/use-teams";
import { useWorkTree } from "../hooks/use-structure";
import type { WorkItemTree } from "../types/api.types";
import { CreateTaskModal } from "./CreateTaskModal";
import { TasksTable } from "./TasksTable";
import { TaskFilterBar } from "./TaskFilterBar";
import { TaskDetailPanel } from "../gantt/components/TaskDetailPanel";
import {
  EMPTY_TASK_FILTERS,
  activeFilterCount,
  UNASSIGNED,
  countTasks,
  filterTasks,
  taskFiltersReducer,
} from "./task-filters";

// Tamaño de página de la tabla. La consulta sigue trayendo todas las tareas del
// proyecto de una vez (las necesitan otras vistas del detalle para sus métricas),
// pero la tabla ya no las renderiza todas juntas: pagina en cliente.
const PAGE_SIZE = 25;

/** Aplana el árbol de estructura a un mapa id → {nombre, tipoId}, para el tag
 * de ubicación de cada tarea en la tabla. */
function flattenLocations(nodes: WorkItemTree[]): Map<string, { name: string; tipoId: string }> {
  const map = new Map<string, { name: string; tipoId: string }>();
  const visit = (node: WorkItemTree) => {
    map.set(node.id, { name: node.nombre, tipoId: node.tipo_id });
    node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return map;
}

/**
 * Cifra de cabecera. Clickable cuando representa un filtro: el número señala un
 * problema ("4 vencidas") y lo natural es querer ver justo esas cuatro, no
 * tener que reconstruir el filtro a mano en la barra de abajo.
 */
function StatTile({
  icon: Icon,
  label,
  value,
  tone,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", tone)}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-lg font-semibold leading-tight tabular-nums text-foreground">
          {value}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">{label}</span>
      </span>
    </>
  );

  if (!onClick) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5">
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-3 rounded-2xl border bg-card px-3 py-2.5 text-left transition",
        active ? "border-brand-gold ring-2 ring-brand-gold/20" : "border-border hover:bg-accent",
      )}
    >
      {content}
    </button>
  );
}

export function TasksPage() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const { dark, toggleDark } = useOutletContext<AppOutletContext>();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const isElevated = hasRole([Role.ADMIN, Role.SUPER_ADMIN, Role.DEVELOPER]);
  const projectQuery = useProject(projectId);
  const tasksQuery = useProjectTasks(projectId);
  const membersQuery = useProjectMembers(projectId);
  const teamsQuery = useTeams(projectId);
  const treeQuery = useWorkTree(projectId);

  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Un reducer y no seis useState: casi todos los filtros comparten la misma
  // consecuencia (volver a la página 1), y así ese reset vive en un solo sitio.
  const [filters, dispatch] = useReducer(taskFiltersReducer, EMPTY_TASK_FILTERS);

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const tree = useMemo(() => treeQuery.data ?? [], [treeQuery.data]);

  // Deriva del listado en vivo (no una copia local) para que el panel refleje
  // cambios como adjuntar/quitar de la estructura sin cerrarse y reabrirse.
  const selected = useMemo(
    () => tasks.find((t) => t.id === selectedId) ?? null,
    [tasks, selectedId],
  );

  const filtered = useMemo(() => filterTasks(tasks, filters, tree), [tasks, filters, tree]);

  // Sobre lo filtrado, no sobre el proyecto entero: si estás mirando un equipo,
  // "3 vencidas" tiene que ser 3 de ese equipo o el número contradice la tabla.
  const today = new Date().toISOString().slice(0, 10);
  const counters = useMemo(() => countTasks(filtered, today), [filtered, today]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(filters.page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );

  const locationById = useMemo(() => flattenLocations(tree), [tree]);
  const hasFilters = activeFilterCount(filters) > 0;

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-5">
      <header className="flex shrink-0 flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <button
            type="button"
            onClick={() => void navigate(`/projects/${projectId}`)}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" />
            {projectQuery.data?.name ?? "Proyecto"}
          </button>
          <button
            type="button"
            onClick={toggleDark}
            aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            <ListChecks className="size-5 text-emerald-600" /> Tareas
          </h1>
          <button
            type="button"
            onClick={() => {
              setShowCreate(true);
            }}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:bg-brand-gold-dark"
          >
            <Plus className="size-4" /> Nueva tarea
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile
            icon={ListChecks}
            label={hasFilters ? "Tareas (filtradas)" : "Tareas"}
            value={counters.total}
            tone="bg-slate-500/10 text-slate-600 dark:text-slate-300"
          />
          <StatTile
            icon={UserX}
            label="Sin repartir"
            value={counters.unassigned}
            tone="bg-amber-500/10 text-amber-600 dark:text-amber-400"
            active={filters.assigneeId === UNASSIGNED}
            onClick={() => {
              dispatch({
                type: "set",
                change: { assigneeId: filters.assigneeId === UNASSIGNED ? null : UNASSIGNED },
              });
            }}
          />
          <StatTile
            icon={AlertTriangle}
            label="Vencidas"
            value={counters.overdue}
            tone="bg-rose-500/10 text-rose-600 dark:text-rose-400"
          />
          <StatTile
            icon={Send}
            label="En revisión"
            value={counters.inReview}
            tone="bg-brand-blue/10 text-brand-blue"
            active={filters.status === "en_revision"}
            onClick={() => {
              dispatch({
                type: "set",
                change: { status: filters.status === "en_revision" ? "todos" : "en_revision" },
              });
            }}
          />
          <StatTile
            icon={CheckCircle2}
            label="Completadas"
            value={counters.done}
            tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            active={filters.status === "completada"}
            onClick={() => {
              dispatch({
                type: "set",
                change: { status: filters.status === "completada" ? "todos" : "completada" },
              });
            }}
          />
        </div>

        <TaskFilterBar
          filters={filters}
          dispatch={dispatch}
          teams={teamsQuery.data?.items ?? []}
          members={membersQuery.data ?? []}
          tree={tree}
        />
      </header>

      {tasksQuery.isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-accent" />
      ) : filtered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border text-center">
          <ListChecks className="size-8 text-muted-foreground/40" />
          {/* Distingue "no hay nada" de "tus filtros no dejan pasar nada": son
              dos situaciones distintas y la salida de cada una también. */}
          {hasFilters ? (
            <>
              <p className="text-sm text-muted-foreground">
                Ninguna de las {tasks.length} tareas del proyecto coincide con los filtros.
              </p>
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: "reset" });
                }}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
              >
                Limpiar filtros
              </button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Este proyecto todavía no tiene tareas. Crea la primera con “Nueva tarea”.
            </p>
          )}
        </div>
      ) : (
        <>
          <TasksTable
            projectId={projectId}
            tasks={paginated}
            members={membersQuery.data ?? []}
            teams={teamsQuery.data?.items ?? []}
            tree={tree}
            locationById={locationById}
            currentUserId={user?.id}
            isElevated={isElevated}
            onOpenDetail={(id) => {
              setSelectedId(id);
            }}
          />

          {/* Paginación: la tabla ya no renderiza todas las tareas de una vez. */}
          <div className="flex shrink-0 items-center justify-between text-xs text-muted-foreground">
            <span>
              {filtered.length} tarea{filtered.length === 1 ? "" : "s"}
              {hasFilters && tasks.length !== filtered.length && ` de ${String(tasks.length)}`}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  aria-label="Página anterior"
                  onClick={() => {
                    dispatch({ type: "page", page: safePage - 1 });
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border transition hover:bg-accent disabled:opacity-40"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <span>
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  aria-label="Página siguiente"
                  onClick={() => {
                    dispatch({ type: "page", page: safePage + 1 });
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border transition hover:bg-accent disabled:opacity-40"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {showCreate && (
        <CreateTaskModal
          projectId={projectId}
          tasks={tasks}
          onClose={() => {
            setShowCreate(false);
          }}
        />
      )}
      {selected && (
        <TaskDetailPanel
          projectId={projectId}
          task={selected}
          onClose={() => {
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}
