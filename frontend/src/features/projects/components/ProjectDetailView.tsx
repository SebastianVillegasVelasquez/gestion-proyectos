import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  FolderTree,
  GanttChartSquare,
  FileSpreadsheet,
  History,
  LayoutGrid,
  ListChecks,
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
import { useProjectTasks } from "../hooks/use-tasks";
import { deriveTaskMetrics } from "../utils/task-metrics";
import { ProjectHero } from "./detail/ProjectHero";
import { ProjectChartsCard } from "./detail/ProjectChartsCard";
import { UpcomingDeadlinesCard } from "./detail/UpcomingDeadlinesCard";
import { ProjectActivityCard } from "./detail/ProjectActivityCard";
import { ClientAccessButton } from "./detail/ClientAccessButton";
import { ProjectNotesCard } from "./detail/ProjectNotesCard";

// Cada sección es una vista/pantalla independiente (ruta propia). Cronograma y
// Tareas también son accesos aquí (sus datos ya están en el resumen). El color de
// cada acceso identifica su función; no es aleatorio.
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
    meta: "Fases, cursos y temas",
    icon: FolderTree,
    accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    to: "gantt",
    label: "Cronograma",
    meta: "Línea de tiempo por fases",
    icon: GanttChartSquare,
    accent: "bg-brand-blue/10 text-brand-blue",
  },
  {
    to: "tareas",
    label: "Tareas",
    meta: "Crea, asigna y da seguimiento",
    icon: ListChecks,
    accent: "bg-brand-blue/10 text-brand-blue",
  },
  {
    to: "integrantes",
    label: "Integrantes",
    meta: "Personas asignadas al proyecto",
    icon: Users,
    accent: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    to: "equipos",
    label: "Equipos de trabajo",
    meta: "Grupos de trabajo y su avance",
    icon: UsersRound,
    accent: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    to: "trazabilidad",
    label: "Trazabilidad",
    meta: "Historial de cambios y eventos",
    icon: History,
    accent: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  },
  {
    to: "informe",
    label: "Informe",
    meta: "Estado del proyecto y exportación",
    icon: FileSpreadsheet,
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

/** Card con el índice de secciones del proyecto (accesos a cada vista). */
function SectionsCard({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  return (
    <Card className="rounded-2xl">
      <CardContent className="flex h-full flex-col gap-1 py-5">
        <div className="mb-1 flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <LayoutGrid className="size-[18px]" />
          </span>
          <p className="text-[15px] font-semibold text-foreground">Secciones del proyecto</p>
        </div>
        {/* Dos por fila: con seis secciones, la lista en columna estiraba esta
            tarjeta muy por encima de la de al lado y dejaba un hueco blanco
            debajo. En rejilla ocupan tres filas exactas, sin sobrantes. */}
        <div className="grid flex-1 grid-cols-1 gap-1 sm:grid-cols-2">
          {SECTIONS.map(({ to, label, meta, icon: Icon, accent }) => (
            <button
              key={to}
              type="button"
              onClick={() => void navigate(`/projects/${projectId}/${to}`)}
              className="group flex items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-accent"
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
        </div>
      </CardContent>
    </Card>
  );
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

  // El resumen (progreso, distribución, atrasos, vencimientos) se deriva de las
  // tareas reales del proyecto; ya existía como endpoint, aquí solo se agrega.
  const tasksQuery = useProjectTasks(project.id);
  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const metrics = useMemo(() => deriveTaskMetrics(tasks), [tasks]);

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
    // El scroll vive en el contenedor de ancho completo (la barra queda pegada al
    // borde derecho de la pantalla); el contenido se centra con un ancho máximo.
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 p-4 sm:p-6 lg:px-10">
        {/* Encabezado compacto: título + meta (fecha · institución) a la izquierda,
            acciones agrupadas a la derecha. */}
        <header className="shrink-0">
          <button
            type="button"
            onClick={() => void navigate("/projects")}
            className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" />
            Proyectos
          </button>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
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
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="size-4" />
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
            {/* Acciones agrupadas a la derecha */}
            <div className="flex shrink-0 items-center gap-2">
              <ClientAccessButton projectId={project.id} />
              <button
                type="button"
                onClick={onToggleDark}
                aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
                className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
            </div>
          </div>
        </header>

        {/* Hero de estado */}
        {/* Las cajas se dibujan desde el principio y esperan el dato dentro:
            reemplazarlas por un rectángulo gris dejaba la pantalla sin forma y
            hacía saltar todo el layout al llegar la respuesta. */}
        <ProjectHero project={project} metrics={metrics} loading={tasksQuery.isLoading} />

        {/* Cuerpo en grid 60/40 */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          {/* Columna izquierda (~60%). La última tarjeta crece para ocupar el
              alto sobrante: si no, la columna más corta termina antes y deja
              una franja en blanco a un lado. */}
          <div className="flex flex-col gap-5 lg:col-span-3">
            <ProjectChartsCard tasks={tasks} loading={tasksQuery.isLoading} />
            <div className="flex flex-1 flex-col">
              <UpcomingDeadlinesCard
                projectId={project.id}
                tasks={tasks}
                loading={tasksQuery.isLoading}
              />
            </div>
          </div>

          {/* Columna derecha (~40%) */}
          <div className="flex flex-col gap-5 lg:col-span-2">
            <SectionsCard projectId={project.id} />
            <div className="flex flex-1 flex-col">
              <ProjectActivityCard projectId={project.id} />
            </div>
          </div>
        </div>

        {/* Notas / recordatorios del proyecto: card a todo el ancho */}
        <ProjectNotesCard projectId={project.id} />
      </div>
    </div>
  );
}
