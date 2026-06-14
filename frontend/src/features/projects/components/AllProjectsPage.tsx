import { useNavigate } from "react-router";
import { useOutletContext } from "react-router";
import {
  Plus,
  Moon,
  Sun,
  Pencil,
  Trash2,
  FolderOpen,
  BookOpen,
  FileText,
  Calendar,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import { useProjectsContext, type StoredProject } from "../context/ProjectsContext";
import { NODE_TYPE_LABELS } from "../types";

// ── helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) {
    return "—";
  }
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) {
    return "justo ahora";
  }
  if (mins < 60) {
    return `hace ${mins} min`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `hace ${hours} h`;
  }
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

function getNodeStats(nodes: StoredProject["nodes"]) {
  return {
    programas: nodes.filter((n) => n.node_type === "programa").length,
    cursos: nodes.filter((n) => n.node_type === "curso").length,
    modulos: nodes.filter((n) => n.node_type === "modulo").length,
  };
}

// ── project card ──────────────────────────────────────────────────────────

function ProjectCard({
  stored,
  onOpen,
  onEdit,
  onDelete,
}: {
  stored: StoredProject;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const stats = getNodeStats(stored.nodes);
  const hasNodes = stored.nodes.length > 0;

  return (
    <Card
      className="flex cursor-pointer flex-col transition-all duration-150 hover:border-blue-300 hover:shadow-md dark:hover:border-blue-700 dark:hover:shadow-slate-900"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onOpen();
        }
      }}
      aria-label={`Abrir proyecto ${stored.project.name || "sin nombre"}`}
    >
      <CardContent className="flex flex-1 flex-col gap-4 pt-5">
        {/* Top row: title + actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className={cn(
                "truncate font-semibold text-slate-900 dark:text-slate-50",
                !stored.project.name && "italic opacity-50",
              )}
            >
              {stored.project.name || "Proyecto sin nombre"}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              Actualizado {timeAgo(stored.updatedAt)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              title="Editar en el constructor"
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors duration-150 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Eliminar proyecto"
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Date range */}
        <div className="flex items-center gap-1.5 text-[12px] text-slate-500 dark:text-slate-400">
          <Calendar className="size-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
          <span>
            {formatDate(stored.project.start_date)}
            <span className="mx-1.5 text-slate-300 dark:text-slate-600">→</span>
            {formatDate(stored.project.end_date)}
          </span>
        </div>

        {/* Node statistics */}
        {hasNodes ? (
          <div className="flex flex-wrap gap-2">
            <StatPill
              icon={<FolderOpen className="size-3" />}
              count={stats.programas}
              label={NODE_TYPE_LABELS.programa}
              color="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
            />
            <StatPill
              icon={<BookOpen className="size-3" />}
              count={stats.cursos}
              label={NODE_TYPE_LABELS.curso}
              color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            />
            <StatPill
              icon={<FileText className="size-3" />}
              count={stats.modulos}
              label={NODE_TYPE_LABELS.modulo}
              color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            />
          </div>
        ) : (
          <p className="text-[12px] italic text-slate-400 dark:text-slate-600">
            Sin nodos definidos
          </p>
        )}

        {/* Total nodes count */}
        {hasNodes && (
          <p className="mt-auto text-[11px] text-slate-400 dark:text-slate-500">
            {stored.nodes.length} nodo{stored.nodes.length !== 1 ? "s" : ""} en total
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StatPill({
  icon,
  count,
  label,
  color,
}: {
  icon: React.ReactNode;
  count: number;
  label: string;
  color: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium",
        color,
      )}
    >
      {icon}
      {count} {label.toLowerCase()}
      {count !== 1 ? "s" : ""}
    </span>
  );
}

// ── empty state ────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
        <Layers className="size-8 text-slate-400 dark:text-slate-500" />
      </div>
      <div className="text-center">
        <p className="font-medium text-slate-700 dark:text-slate-300">Aún no tienes proyectos</p>
        <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
          Crea tu primer proyecto educativo y define su estructura
        </p>
      </div>
      <button
        type="button"
        onClick={onNew}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-blue-700"
      >
        <Plus className="size-4" />
        Crear primer proyecto
      </button>
    </div>
  );
}

// ── page ───────────────────────────────────────────────────────────────────

export function AllProjectsPage() {
  const { dark, toggleDark } = useOutletContext<AppOutletContext>();
  const { projects, setActiveProjectId, deleteProject } = useProjectsContext();
  const navigate = useNavigate();

  const handleNew = () => {
    setActiveProjectId(null);
    navigate("/projects/builder");
  };

  const handleOpen = (id: string) => {
    navigate(`/projects/${id}`);
  };

  const handleEdit = (id: string) => {
    setActiveProjectId(id);
    navigate("/projects/builder");
  };

  const handleDelete = (id: string, name: string) => {
    const label = name.trim() || "este proyecto";
    if (window.confirm(`¿Eliminar "${label}"? Esta acción no se puede deshacer.`)) {
      deleteProject(id);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-5 lg:h-full lg:overflow-hidden">
      {/* Header */}
      <header className="flex shrink-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
            Todos los proyectos
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {projects.length > 0
              ? `${projects.length} proyecto${projects.length !== 1 ? "s" : ""} guardado${projects.length !== 1 ? "s" : ""}`
              : "Sin proyectos aún"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleDark}
            aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors duration-150 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>

          {projects.length > 0 && (
            <button
              type="button"
              onClick={handleNew}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-blue-700 dark:hover:bg-blue-500"
            >
              <Plus className="size-4" />
              Nuevo proyecto
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      {projects.length === 0 ? (
        <EmptyState onNew={handleNew} />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((stored) => (
              <ProjectCard
                key={stored.id}
                stored={stored}
                onOpen={() => {
                  handleOpen(stored.id);
                }}
                onEdit={() => {
                  handleEdit(stored.id);
                }}
                onDelete={() => {
                  handleDelete(stored.id, stored.project.name);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
