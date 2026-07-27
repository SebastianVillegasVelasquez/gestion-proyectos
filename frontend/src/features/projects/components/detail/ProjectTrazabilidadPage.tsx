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
      accentClass="bg-slate-500/10 text-slate-600 dark:text-slate-300"
    >
      <TraceabilityPanel projectId={projectId!} />
    </ProjectSectionShell>
  );
}
