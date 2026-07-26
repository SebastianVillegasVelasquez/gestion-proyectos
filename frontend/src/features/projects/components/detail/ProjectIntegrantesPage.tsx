import { useParams } from "react-router";
import { MembersPanel } from "./MembersPanel";

export function ProjectIntegrantesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return <MembersPanel projectId={projectId!} />;
}
