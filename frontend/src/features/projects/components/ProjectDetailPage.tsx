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
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
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
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
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
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent"
          >
            Volver a proyectos
          </button>
        }
      />
    );
  }

  return <ProjectDetailView project={project} dark={dark} onToggleDark={toggleDark} />;
}
