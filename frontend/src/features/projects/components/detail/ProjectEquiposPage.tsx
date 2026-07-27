import { useParams } from "react-router";
import { UsersRound } from "lucide-react";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { ProjectSectionShell } from "./ProjectSectionShell";
import { ProjectTeamsPage } from "./ProjectTeamsPage";

export function ProjectEquiposPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return (
    <ProjectSectionShell
      projectId={projectId!}
      title="Equipos de trabajo"
      icon={UsersRound}
      accentClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    >
      <ErrorBoundary
        fallbackTitle="No se pudo mostrar el apartado de equipos"
        fallbackHint="Ocurrió un error al renderizar los equipos de trabajo. Intenta recargar."
      >
        <ProjectTeamsPage projectId={projectId!} />
      </ErrorBoundary>
    </ProjectSectionShell>
  );
}
