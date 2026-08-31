import type { ReactNode } from "react";
import { useNavigate, useOutletContext } from "react-router";
import { ChevronLeft, Moon, Sun, type LucideIcon } from "lucide-react";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import { useProject } from "../../hooks/use-projects";

/**
 * Envoltura común de las vistas de sección del proyecto (Estructura,
 * Integrantes, Equipos, etc.). Cada sección vive en su propia ruta/pantalla
 * —no como pestaña embebida— y comparte esta cabecera: migas de pan hacia el
 * detalle, título con ícono y alternador de tema. El botón "Volver" regresa
 * siempre al detalle del proyecto, que es la vista principal.
 */
export function ProjectSectionShell({
  projectId,
  title,
  icon: Icon,
  accentClass = "bg-brand-blue/10 text-brand-blue",
  wide = false,
  children,
}: {
  projectId: string;
  title: string;
  icon: LucideIcon;
  accentClass?: string;
  /** Ensancha el contenedor: para vistas con mucha información por fila (la
   * Estructura, ahora que cada elemento puede ser tarea y traer subtareas). */
  wide?: boolean;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { dark, toggleDark } = useOutletContext<AppOutletContext>();
  const { data: project } = useProject(projectId);

  const backToDetail = () => void navigate(`/projects/${projectId}`);

  return (
    <div
      className={`mx-auto flex h-full w-full flex-col gap-5 overflow-hidden p-4 sm:p-6 lg:px-12 ${
        wide ? "max-w-[1600px]" : "max-w-6xl"
      }`}
    >
      <header className="flex shrink-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <button
            type="button"
            onClick={backToDetail}
            className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" />
            {project?.name ?? "Detalle del proyecto"}
          </button>
          <div className="flex items-center gap-3">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${accentClass}`}
            >
              <Icon className="size-5" />
            </div>
            <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
              {title}
            </h1>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleDark}
          aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
