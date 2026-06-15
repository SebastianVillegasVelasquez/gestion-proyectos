import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "@/features/projects/api/projects.api";
import { phasesApi } from "@/features/projects/api/phases.api";
import { nodesApi } from "@/features/projects/api/nodes.api";
import { projectKeys } from "@/features/projects/hooks/query-keys";
import { getErrorMessage } from "@/utils/get-error-message";
import { persistDraft } from "./persist-draft";
import type { DraftNode, DraftPhase, DraftProject } from "./draft.types";
import type { ProjectNode } from "@/features/projects/types/api.types";

/**
 * Orquesta la creación de un proyecto completo (proyecto → fases → nodos).
 * Encapsula el estado de carga/error y la invalidación del cache de la lista.
 */
export function useCreateProjectDraft() {
  const qc = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (
    project: DraftProject,
    phases: DraftPhase[],
    nodes: DraftNode[],
  ): Promise<string | null> => {
    setIsSubmitting(true);
    setError(null);
    try {
      const created = await persistDraft(project, phases, nodes, {
        createProject: projectsApi.create,
        createPhase: phasesApi.create,
        createNode: (payload) => nodesApi.create(payload).then((r) => r as ProjectNode),
      });
      await qc.invalidateQueries({ queryKey: projectKeys.list() });
      return created.id;
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo crear el proyecto"));
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  return { submit, isSubmitting, error };
}
