import { useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router";
import { Plus, Moon, Sun, Trash2, Layers, Search, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import { useSortableData } from "@/hooks/use-sortable-data";
import { SortableTh } from "@/components/ui/SortableTh";
import { useProjects, useDeleteProject } from "../hooks/use-projects";
import { filterProjects, monogram, monogramTone, shortId } from "../utils/project-table";
import type { Project } from "../types/api.types";

// Columnas ordenables (el ID truncado y las acciones no tiene sentido ordenarlos).
type SortKey = "name" | "start_date" | "progress_pct";

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function ProjectRow({
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
    <tr
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onOpen();
        }
      }}
      aria-label={`Abrir proyecto ${project.name}`}
      className="group cursor-pointer border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50/80 focus:outline-none focus-visible:bg-slate-50 dark:border-slate-800/70 dark:hover:bg-slate-900/60 dark:focus-visible:bg-slate-900"
    >
      {/* Marca + nombre + cliente */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
              monogramTone(project.name),
            )}
          >
            {monogram(project.name)}
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              {project.name}
              <ArrowUpRight className="size-3.5 shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-600" />
            </p>
            <p className="truncate text-xs text-slate-400 dark:text-slate-500">
              {project.client_name ?? "Sin cliente"}
            </p>
          </div>
        </div>
      </td>

      {/* Identificador corto */}
      <td className="hidden px-4 py-3 md:table-cell">
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {shortId(project.id)}
        </code>
      </td>

      {/* Periodo */}
      <td className="hidden whitespace-nowrap px-4 py-3 text-xs text-slate-500 dark:text-slate-400 lg:table-cell">
        {formatDate(project.start_date)}
        <span className="mx-1.5 text-slate-300 dark:text-slate-600">→</span>
        {formatDate(project.end_date)}
      </td>

      {/* Progreso */}
      <td className="w-44 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-brand-gold transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="w-9 shrink-0 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
            {progress}%
          </span>
        </div>
      </td>

      {/* Acciones */}
      <td className="w-12 px-2 py-3 text-right">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Eliminar proyecto"
          aria-label={`Eliminar proyecto ${project.name}`}
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-300 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-600 focus-visible:opacity-100 group-hover:opacity-100 dark:text-slate-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
        >
          <Trash2 className="size-3.5" />
        </button>
      </td>
    </tr>
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

const HEADER_CELL =
  "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500";

export function AllProjectsPage() {
  const { dark, toggleDark } = useOutletContext<AppOutletContext>();
  const navigate = useNavigate();
  const { data: projects, isLoading, isError } = useProjects();
  const deleteProject = useDeleteProject();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => filterProjects(projects ?? [], search), [projects, search]);
  const {
    sorted: visible,
    sort,
    toggleSort,
  } = useSortableData<Project, SortKey>(filtered, (project, key) => {
    switch (key) {
      case "name":
        return project.name;
      case "start_date":
        return project.start_date;
      case "progress_pct":
        return project.progress_pct;
    }
  });

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
              ? `${projects.length} proyecto${projects.length !== 1 ? "s" : ""} en gestión`
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
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
            />
          ))}
        </div>
      ) : !projects || projects.length === 0 ? (
        <EmptyState onNew={() => navigate("/projects/builder")} />
      ) : (
        <>
          {/* Búsqueda por nombre, cliente o identificador */}
          <div className="relative w-full shrink-0 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              placeholder="Buscar por nombre, cliente o ID…"
              aria-label="Buscar proyecto"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-brand-gold/25"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            {visible.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                Ningún proyecto coincide con «{search}».
              </p>
            ) : (
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur dark:bg-slate-900/95">
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <SortableTh
                      label="Proyecto"
                      columnKey="name"
                      activeKey={sort.key}
                      direction={sort.direction}
                      onSort={toggleSort}
                      className={HEADER_CELL}
                    />
                    <th className={cn(HEADER_CELL, "hidden md:table-cell")}>ID</th>
                    <SortableTh
                      label="Periodo"
                      columnKey="start_date"
                      activeKey={sort.key}
                      direction={sort.direction}
                      onSort={toggleSort}
                      className={cn(HEADER_CELL, "hidden lg:table-cell")}
                    />
                    <SortableTh
                      label="Progreso"
                      columnKey="progress_pct"
                      activeKey={sort.key}
                      direction={sort.direction}
                      onSort={toggleSort}
                      className={HEADER_CELL}
                    />
                    <th className={cn(HEADER_CELL, "w-12")}>
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((project) => (
                    <ProjectRow
                      key={project.id}
                      project={project}
                      onOpen={() => navigate(`/projects/${project.id}`)}
                      onDelete={() => {
                        handleDelete(project.id, project.name);
                      }}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
