import type {
  CreateNodePayload,
  CreatePhasePayload,
  Phase,
  Project,
  ProjectNode,
} from "@/features/projects/types/api.types";
import type { DraftNode, DraftPhase, DraftProject } from "./draft.types";

export interface DraftCreators {
  createProject: (payload: {
    name: string;
    description?: string | null;
    client_name?: string | null;
    start_date?: string | null;
    end_date?: string | null;
  }) => Promise<Project>;
  createPhase: (projectId: string, payload: CreatePhasePayload) => Promise<Phase>;
  createNode: (payload: CreateNodePayload) => Promise<ProjectNode>;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Ordena los nodos para que cada padre se cree antes que sus hijos. */
export function orderByDepth(nodes: DraftNode[]): DraftNode[] {
  const byTempId = new Map(nodes.map((n) => [n.tempId, n]));
  const depthOf = (n: DraftNode): number => {
    let depth = 0;
    let current: DraftNode | undefined = n;
    const seen = new Set<string>();
    while (current?.parentTempId && byTempId.has(current.parentTempId)) {
      if (seen.has(current.tempId)) {
        break; // guard contra ciclos
      }
      seen.add(current.tempId);
      depth += 1;
      current = byTempId.get(current.parentTempId);
    }
    return depth;
  };
  return [...nodes].sort((a, b) => depthOf(a) - depthOf(b));
}

/**
 * Persiste un borrador completo resolviendo los IDs temporales a reales:
 * proyecto → fases → nodos (padres antes que hijos). Devuelve el proyecto creado.
 */
export async function persistDraft(
  project: DraftProject,
  phases: DraftPhase[],
  nodes: DraftNode[],
  creators: DraftCreators,
): Promise<Project> {
  const created = await creators.createProject({
    name: project.name.trim(),
    description: emptyToNull(project.description),
    client_name: emptyToNull(project.client_name),
    start_date: emptyToNull(project.start_date),
    end_date: emptyToNull(project.end_date),
  });

  const phaseIdMap = new Map<string, string>();
  for (const phase of phases) {
    const durationRaw = phase.duration_days.trim();
    const createdPhase = await creators.createPhase(created.id, {
      name: phase.name.trim(),
      duration_days: durationRaw === "" ? null : Number(durationRaw),
      start_date: emptyToNull(phase.start_date),
      end_date: emptyToNull(phase.end_date),
    });
    phaseIdMap.set(phase.tempId, createdPhase.id);
  }

  const nodeIdMap = new Map<string, string>();
  for (const node of orderByDepth(nodes)) {
    const createdNode = await creators.createNode({
      name: node.name.trim(),
      node_type: node.node_type,
      project_id: created.id,
      parent_id: node.parentTempId ? (nodeIdMap.get(node.parentTempId) ?? null) : null,
      phase_id: node.phaseTempId ? (phaseIdMap.get(node.phaseTempId) ?? null) : null,
      type_label: emptyToNull(node.type_label),
      end_date: emptyToNull(node.end_date),
    });
    nodeIdMap.set(node.tempId, createdNode.id);
  }

  return created;
}
