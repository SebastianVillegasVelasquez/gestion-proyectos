export type NodeType = "programa" | "curso" | "modulo";

export const NODE_CHILD_TYPE: Partial<Record<NodeType, NodeType>> = {
  programa: "curso",
  curso: "modulo",
};

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  programa: "Programa",
  curso: "Curso",
  modulo: "Módulo",
};

export const NODE_TYPE_OPTIONS: { value: NodeType; label: string }[] = [
  { value: "programa", label: "Programa" },
  { value: "curso", label: "Curso" },
  { value: "modulo", label: "Módulo" },
];

export interface ProjectFormData {
  name: string;
  start_date: string;
  end_date: string;
}

export interface BuilderNode {
  id: string;
  name: string;
  node_type: NodeType;
  parent_id: string | null;
}

export interface CreateProjectPayload {
  project: ProjectFormData & { progress_pct: number };
  nodes: {
    temp_id: string;
    name: string;
    node_type: NodeType;
    parent_temp_id: string | null;
  }[];
}

// ── project members ────────────────────────────────────────────────────────

export type ProjectRole = "coordinador" | "integrante" | "revisor";

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  coordinador: "Coordinador",
  integrante: "Integrante",
  revisor: "Revisor",
};

export const PROJECT_ROLE_OPTIONS: { value: ProjectRole; label: string }[] = [
  { value: "coordinador", label: "Coordinador" },
  { value: "integrante", label: "Integrante" },
  { value: "revisor", label: "Revisor" },
];

export const AVATAR_COLORS = [
  "bg-violet-600",
  "bg-blue-600",
  "bg-emerald-600",
  "bg-amber-500",
  "bg-rose-600",
  "bg-cyan-600",
] as const;

export interface ProjectMember {
  id: string;
  name: string;
  initials: string;
  role: ProjectRole;
  avatarColor: string;
}
