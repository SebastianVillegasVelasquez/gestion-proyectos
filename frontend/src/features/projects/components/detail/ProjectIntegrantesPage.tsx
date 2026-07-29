import { useParams } from "react-router";
import { Users } from "lucide-react";
import { ProjectSectionShell } from "./ProjectSectionShell";
import { MembersPanel } from "./MembersPanel";

export function ProjectIntegrantesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return (
    <ProjectSectionShell
      projectId={projectId!}
      title="Integrantes"
      icon={Users}
      accentClass="bg-brand-blue/10 text-brand-blue"
    >
      <MembersPanel projectId={projectId!} />
    </ProjectSectionShell>
  );
}
