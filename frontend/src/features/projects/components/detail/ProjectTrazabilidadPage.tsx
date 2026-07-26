import { useParams } from "react-router";
import { TraceabilityPanel } from "./TraceabilityPanel";

export function ProjectTrazabilidadPage() {
  const { projectId } = useParams<{ projectId: string }>();
  return <TraceabilityPanel projectId={projectId!} />;
}
