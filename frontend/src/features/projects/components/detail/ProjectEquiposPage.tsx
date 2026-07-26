import { useParams } from "react-router";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { ProjectTeamsPage } from "./ProjectTeamsPage";

export function ProjectEquiposPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return (
    <ErrorBoundary
      fallbackTitle="No se pudo mostrar el apartado de equipos"
      fallbackHint="Ocurrió un error al renderizar los equipos de trabajo. Intenta recargar."
    >
      <ProjectTeamsPage projectId={projectId!} />
    </ErrorBoundary>
  );
}
