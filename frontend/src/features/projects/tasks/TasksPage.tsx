import { useMemo, useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router";
import { Plus, Moon, Sun, ListChecks, Search, ChevronLeft } from "lucide-react";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import { useProject } from "../hooks/use-projects";
import { useProjectTasks } from "../hooks/use-tasks";
import { useProjectMembers } from "../hooks/use-members";
import { useTeams } from "../hooks/use-teams";
import { useWorkTree } from "../hooks/use-structure";
import type { WorkItemTree } from "../types/api.types";
import { CreateTaskModal } from "./CreateTaskModal";
import { TasksTable } from "./TasksTable";
import { TaskDetailPanel } from "../gantt/components/TaskDetailPanel";

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

export function TasksPage() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const { dark, toggleDark } = useOutletContext<AppOutletContext>();
  const navigate = useNavigate();
  const projectQuery = useProject(projectId);
  const tasksQuery = useProjectTasks(projectId);
  const membersQuery = useProjectMembers(projectId);
  const teamsQuery = useTeams(projectId);
  const treeQuery = useWorkTree(projectId);

  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  // Deriva del listado en vivo (no una copia local) para que el panel refleje
  // cambios como adjuntar/quitar de la estructura sin cerrarse y reabrirse.
  const selected = useMemo(
    () => tasks.find((t) => t.id === selectedId) ?? null,
    [tasks, selectedId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return tasks;
    }
    return tasks.filter(
      (t) => t.title.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q),
    );
  }, [tasks, search]);

  const locationById = useMemo(() => flattenLocations(treeQuery.data ?? []), [treeQuery.data]);

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
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                }}
                placeholder="Buscar tarea…"
                aria-label="Buscar tarea"
                className="w-48 rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 sm:w-64"
              />
            </div>
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
        </div>
      </header>

      {tasksQuery.isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-accent" />
      ) : (
        <TasksTable
          projectId={projectId}
          tasks={filtered}
          members={membersQuery.data ?? []}
          teams={teamsQuery.data?.items ?? []}
          locationById={locationById}
          onOpenDetail={(id) => {
            setSelectedId(id);
          }}
        />
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
