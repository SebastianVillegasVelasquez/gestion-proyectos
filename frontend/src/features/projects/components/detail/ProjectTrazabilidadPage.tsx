import { useParams } from "react-router";
import { History } from "lucide-react";
import { ProjectSectionShell } from "./ProjectSectionShell";
import { TraceabilityPanel } from "./TraceabilityPanel";

export function ProjectTrazabilidadPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return (
    <ProjectSectionShell
      projectId={projectId!}
      title="Trazabilidad"
      icon={History}
      accentClass="bg-muted-foreground/10 text-muted-foreground"
      wide
    >
      <TraceabilityPanel projectId={projectId!} />
    </ProjectSectionShell>
  );
}
