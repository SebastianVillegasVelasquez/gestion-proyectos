import type { NodeType } from "@/features/projects/types/api.types";

export interface DraftProject {
  name: string;
  description: string;
  client_name: string;
  start_date: string;
  end_date: string;
}

export interface DraftPhase {
  tempId: string;
  name: string;
  duration_days: string; // input as string; "" = sin definir
  start_date: string;
  end_date: string;
}

export interface DraftNode {
  tempId: string;
  name: string;
  node_type: NodeType;
  type_label: string;
  phaseTempId: string | null;
  parentTempId: string | null;
  end_date: string;
}
