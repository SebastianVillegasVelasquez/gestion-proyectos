import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  FolderTree,
  History,
  Layers,
  Moon,
  Pencil,
  Sun,
  Users,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Project } from "../types/api.types";
import { useUpdateProject } from "../hooks/use-projects";
import { ProjectActions } from "./detail/ProjectActions";
import { ClientAccessCard } from "./detail/ClientAccessCard";

// Cada sección es una vista/pantalla independiente (ruta propia), ya no una
// pestaña embebida. Desde aquí se navega a ellas; cada una regresa al detalle.
const SECTIONS: {
  to: string;
  label: string;
  meta: string;
  icon: LucideIcon;
  accent: string;
}[] = [
  {
    to: "estructura",
    label: "Estructura",
    meta: "Fases, cursos y temas del proyecto",
    icon: FolderTree,
    accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    to: "integrantes",
    label: "Integrantes",
    meta: "Personas asignadas al proyecto",
    icon: Users,
    accent: "bg-brand-blue/10 text-brand-blue",
  },
  {
    to: "equipos",
    label: "Equipos de trabajo",
    meta: "Grupos de trabajo del proyecto",
    icon: UsersRound,
    accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    to: "areas",
    label: "Progreso por equipo",
    meta: "Avance agrupado por cargo",
    icon: Layers,
    accent: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  },
  {
    to: "trazabilidad",
    label: "Trazabilidad",
    meta: "Historial de cambios y eventos",
    icon: History,
    accent: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  },
];

function formatDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export function ProjectDetailView({
  project,
  dark,
  onToggleDark,
}: {
  project: Project;
  dark: boolean;
  onToggleDark: () => void;
}) {
  const navigate = useNavigate();
  const progress = Math.round(project.progress_pct ?? 0);

  // Edición inline del nombre: el CRUD ya existe en el backend (PATCH /projects/{id}),
  // aquí solo se expone. Mientras no se edita, se muestra el título normal.
  const updateProject = useUpdateProject(project.id);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(project.name);

  const startEditName = () => {
    setNameDraft(project.name);
    setEditingName(true);
  };

  const saveName = () => {
    const clean = nameDraft.trim();
    if (!clean || clean === project.name) {
      setEditingName(false);
      return;
    }
    updateProject.mutate(
      { name: clean },
      {
        onSuccess: () => {
          setEditingName(false);
        },
      },
    );
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-5 overflow-y-auto p-4 sm:p-6 lg:px-12">
      {/* Encabezado */}
      <header className="flex shrink-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => void navigate("/projects")}
            className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" />
            Proyectos
          </button>
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                value={nameDraft}
                autoFocus
                disabled={updateProject.isPending}
                onChange={(e) => {
                  setNameDraft(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    saveName();
                  } else if (e.key === "Escape") {
                    setEditingName(false);
                  }
                }}
                className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-2xl font-semibold tracking-tight text-foreground outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 disabled:opacity-60 sm:text-[28px]"
              />
              <button
                type="button"
                onClick={saveName}
                disabled={updateProject.isPending}
                aria-label="Guardar nombre"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-blue text-white transition-colors hover:bg-brand-blue-dark disabled:opacity-50"
              >
                <Check className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingName(false);
                }}
                disabled={updateProject.isPending}
                aria-label="Cancelar"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <div className="group flex items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
                {project.name}
              </h1>
              <button
                type="button"
                onClick={startEditName}
                aria-label="Editar nombre del proyecto"
                title="Editar nombre"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-foreground focus:opacity-100 group-hover:opacity-100"
              >
                <Pencil className="size-4" />
              </button>
            </div>
          )}
          {updateProject.isError && editingName && (
            <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">
              No se pudo guardar el nombre. Inténtalo de nuevo.
            </p>
          )}
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[15px] text-muted-foreground">
            <Calendar className="size-4" />
            <span>
              {formatDate(project.start_date)} → {formatDate(project.end_date)}
            </span>
            {project.client_name && (
              <>
                <span className="text-border">·</span>
                <span>{project.client_name}</span>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleDark}
          aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </header>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1.7fr_1fr]">
        {/* Columna izquierda: accesos, progreso y compartir con el cliente */}
        <div className="flex flex-col gap-5">
          {/* Accesos: Cronograma + Tareas */}
          <ProjectActions projectId={project.id} />

          {/* Progreso */}
          <Card className="shrink-0 rounded-2xl">
            <CardContent className="flex flex-col gap-3 py-5">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-medium text-foreground">Progreso general</span>
                <span className="text-xl font-semibold tabular-nums text-brand-blue-dark dark:text-brand-blue">
                  {progress}%
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-accent">
                <div
                  className="h-full rounded-full bg-brand-blue transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Compartir el avance con el cliente (enlace público de solo lectura) */}
          <ClientAccessCard projectId={project.id} />
        </div>

        {/* Columna derecha: secciones del proyecto, cada una en su propia vista */}
        <aside className="lg:sticky lg:top-1">
          <Card className="rounded-2xl">
            <CardContent className="flex flex-col gap-1 py-4">
              <p className="px-1 pb-1 text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">
                Secciones del proyecto
              </p>
              {SECTIONS.map(({ to, label, meta, icon: Icon, accent }) => (
                <button
                  key={to}
                  type="button"
                  onClick={() => void navigate(`/projects/${project.id}/${to}`)}
                  className="group flex items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-accent"
                >
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${accent}`}
                  >
                    <Icon className="size-[18px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{label}</p>
                    <p className="truncate text-xs text-muted-foreground">{meta}</p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </button>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
