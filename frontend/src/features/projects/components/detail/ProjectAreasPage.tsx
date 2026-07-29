import { useParams } from "react-router";
import { Layers } from "lucide-react";
import { ProjectSectionShell } from "./ProjectSectionShell";
import { AreasPanel } from "./AreasPanel";

export function ProjectAreasPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return (
    <ProjectSectionShell
      projectId={projectId!}
      title="Progreso por equipo"
      icon={Layers}
      accentClass="bg-teal-500/10 text-teal-600 dark:text-teal-400"
    >
      <AreasPanel projectId={projectId!} />
    </ProjectSectionShell>
  );
}
