import { useNavigate, useOutletContext } from "react-router";
import { Plus, Moon, Sun, Trash2, Calendar, Layers, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import { useProjects, useDeleteProject } from "../hooks/use-projects";
import type { Project } from "../types/api.types";

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function ProjectCard({
  project,
  onOpen,
  onDelete,
}: {
  project: Project;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const progress = Math.round(project.progress_pct ?? 0);

  return (
    <Card
      className="flex cursor-pointer flex-col transition-all duration-150 hover:border-brand-gold/40 hover:shadow-md dark:hover:border-brand-gold/40"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onOpen();
        }
      }}
      aria-label={`Abrir proyecto ${project.name}`}
    >
      <CardContent className="flex flex-1 flex-col gap-4 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900 dark:text-slate-50">
              {project.name}
            </p>
            {project.client_name && (
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                <Users className="size-3" /> {project.client_name}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Eliminar proyecto"
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-[12px] text-slate-500 dark:text-slate-400">
          <Calendar className="size-3.5 shrink-0 text-slate-400" />
          <span>
            {formatDate(project.start_date)}
            <span className="mx-1.5 text-slate-300 dark:text-slate-600">→</span>
            {formatDate(project.end_date)}
          </span>
        </div>

        <div className="mt-auto">
          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
            <span>Progreso</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-brand-gold transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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
        className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-brand-gold-dark"
      >
        <Plus className="size-4" />
        Crear primer proyecto
      </button>
    </div>
  );
}

export function AllProjectsPage() {
  const { dark, toggleDark } = useOutletContext<AppOutletContext>();
  const navigate = useNavigate();
  const { data: projects, isLoading, isError } = useProjects();
  const deleteProject = useDeleteProject();

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) {
      deleteProject.mutate(id);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-5 lg:h-full lg:overflow-hidden">
      <header className="flex shrink-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
            Todos los proyectos
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {projects?.length
              ? `${projects.length} proyecto${projects.length !== 1 ? "s" : ""}`
              : "Plataforma de gestión de proyectos"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleDark}
            aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => navigate("/projects/builder")}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-brand-gold-dark"
          >
            <Plus className="size-4" />
            Nuevo proyecto
          </button>
        </div>
      </header>

      {isError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
        >
          No se pudieron cargar los proyectos. Intenta recargar la página.
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
            />
          ))}
        </div>
      ) : !projects || projects.length === 0 ? (
        <EmptyState onNew={() => navigate("/projects/builder")} />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={() => navigate(`/projects/${project.id}`)}
                onDelete={() => {
                  handleDelete(project.id, project.name);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
