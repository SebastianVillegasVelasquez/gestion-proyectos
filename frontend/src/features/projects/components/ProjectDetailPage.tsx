import { useParams, useNavigate, useOutletContext } from "react-router";
import { AlertTriangle } from "lucide-react";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import { useProject } from "../hooks/use-projects";
import { ProjectDetailView } from "./ProjectDetailView";

function CenteredMessage({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/40">
        <AlertTriangle className="size-7 text-amber-500" />
      </div>
      <div>
        <p className="font-semibold text-slate-800 dark:text-slate-200">{title}</p>
        <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export function ProjectDetailPage() {
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
      <CenteredMessage
        title="Proyecto no encontrado"
        subtitle="Es posible que haya sido eliminado o no tengas acceso."
        action={
          <button
            type="button"
            onClick={() => navigate("/projects")}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Volver a proyectos
          </button>
        }
      />
    );
  }

  return <ProjectDetailView project={project} dark={dark} onToggleDark={toggleDark} />;
}
