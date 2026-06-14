import { useParams, useNavigate } from "react-router";
import { useOutletContext } from "react-router";
import { AlertTriangle } from "lucide-react";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import { useProjectsContext } from "../../context/ProjectsContext";
import { TaskDashboardLayout } from "./TaskDashboardLayout";

function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/40">
        <AlertTriangle className="size-7 text-amber-500" />
      </div>
      <div>
        <p className="font-semibold text-slate-800 dark:text-slate-200">
          Proyecto no encontrado
        </p>
        <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
          Es posible que haya sido eliminado.
        </p>
      </div>
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

export function TaskDashboardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { dark, toggleDark } = useOutletContext<AppOutletContext>();
  const { projects } = useProjectsContext();

  const stored = projects.find((p) => p.id === projectId);
  if (!stored) {return <NotFound />;}

  return (
    <TaskDashboardLayout stored={stored} dark={dark} onToggleDark={toggleDark} />
  );
}
