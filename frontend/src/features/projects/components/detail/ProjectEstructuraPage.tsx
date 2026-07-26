import { useParams } from "react-router";
import { StructurePanel } from "./StructurePanel";

export function ProjectEstructuraPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return <StructurePanel projectId={projectId!} />;
}
