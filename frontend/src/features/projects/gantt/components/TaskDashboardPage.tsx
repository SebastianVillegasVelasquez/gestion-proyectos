import { useParams, useNavigate, useOutletContext } from "react-router";
import { AlertTriangle } from "lucide-react";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import { useProject } from "../../hooks/use-projects";
import { GanttView } from "./GanttView";

export function TaskDashboardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { dark, toggleDark } = useOutletContext<AppOutletContext>();
  const navigate = useNavigate();
  const { data: project, isLoading, isError } = useProject(projectId);

  if (isLoading) {
    return (
      <div className="p-5">
        <div className="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/40">
          <AlertTriangle className="size-7 text-amber-500" />
        </div>
        <p className="font-semibold text-slate-800 dark:text-slate-200">Proyecto no encontrado</p>
        <button
          type="button"
          onClick={() => navigate("/projects")}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          Volver a proyectos
        </button>
      </div>
    );
  }

  return <GanttView project={project} dark={dark} onToggleDark={toggleDark} />;
}
