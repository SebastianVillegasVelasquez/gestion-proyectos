import { useParams } from "react-router";
import { FolderTree as FolderTreeIcon } from "lucide-react";
import { ProjectSectionShell } from "@/features/projects/components/detail/ProjectSectionShell";
import { ProjectFilesBrowser } from "./ProjectFilesBrowser";

/** El archivador como sección propia del proyecto (vista de administración). */
export function ProjectFilesPage() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  return (
    <ProjectSectionShell
      projectId={projectId}
      title="Archivos"
      icon={FolderTreeIcon}
      accentClass="bg-brand-gold/10 text-brand-gold-dark dark:text-brand-gold"
      wide
    >
      <ProjectFilesBrowser projectId={projectId} />
    </ProjectSectionShell>
  );
}

export default ProjectFilesPage;
