import { useParams } from "react-router";
import { AreasPanel } from "./AreasPanel";

export function ProjectAreasPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return <AreasPanel projectId={projectId!} />;
}
