import { useParams } from "react-router";
import { FolderTree } from "lucide-react";
import { ProjectSectionShell } from "./ProjectSectionShell";
import { StructurePanel } from "./StructurePanel";

export function ProjectEstructuraPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return (
    <ProjectSectionShell
      projectId={projectId!}
      title="Estructura del proyecto"
      icon={FolderTree}
      accentClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    >
      <StructurePanel projectId={projectId!} />
    </ProjectSectionShell>
  );
}
