import { useCallback, useRef, useState } from "react";
import type { NodeType } from "@/features/projects/types/api.types";
import type { DraftNode, DraftPhase, DraftProject } from "./draft.types";
import { cloneSubtree, collectSubtree, removeSubtree, SUGGESTED_CHILD_TYPE } from "./tree-ops";

export type Selection =
  | { kind: "project" }
  | { kind: "phase"; id: string }
  | { kind: "node"; id: string }
  | null;

const emptyProject: DraftProject = {
  name: "",
  description: "",
  client_name: "",
  start_date: "",
  end_date: "",
};

export function useBuilderState() {
  const seq = useRef(0);
  const genId = useCallback(() => `tmp-${(seq.current += 1)}`, []);

  const [project, setProject] = useState<DraftProject>(emptyProject);
  const [phases, setPhases] = useState<DraftPhase[]>([]);
  const [nodes, setNodes] = useState<DraftNode[]>([]);
  const [selected, setSelected] = useState<Selection>({ kind: "project" });
  const [clipboard, setClipboard] = useState<DraftNode[] | null>(null);

  const setProjectField = useCallback((field: keyof DraftProject, value: string) => {
    setProject((p) => ({ ...p, [field]: value }));
  }, []);

  // ── Phases ──────────────────────────────────────────────────────────────
  const addPhase = useCallback(() => {
    const id = genId();
    setPhases((p) => [
      ...p,
      { tempId: id, name: `Fase ${p.length + 1}`, duration_days: "", start_date: "", end_date: "" },
    ]);
    setSelected({ kind: "phase", id });
  }, [genId]);

  const updatePhase = useCallback((id: string, patch: Partial<DraftPhase>) => {
    setPhases((p) => p.map((ph) => (ph.tempId === id ? { ...ph, ...patch } : ph)));
  }, []);

  const removePhase = useCallback((id: string) => {
    setPhases((p) => p.filter((ph) => ph.tempId !== id));
    setNodes((n) => n.filter((nd) => nd.phaseTempId !== id));
    setSelected(null);
  }, []);

  // ── Nodes ───────────────────────────────────────────────────────────────
  const addNode = useCallback(
    (phaseTempId: string, parentTempId: string | null, nodeType: NodeType) => {
      const id = genId();
      setNodes((n) => [
        ...n,
        {
          tempId: id,
          name: "",
          node_type: nodeType,
          type_label: "",
          phaseTempId,
          parentTempId,
          end_date: "",
        },
      ]);
      setSelected({ kind: "node", id });
    },
    [genId],
  );

  const updateNode = useCallback((id: string, patch: Partial<DraftNode>) => {
    setNodes((n) => n.map((nd) => (nd.tempId === id ? { ...nd, ...patch } : nd)));
  }, []);

  const removeNode = useCallback((id: string) => {
    setNodes((n) => removeSubtree(n, id));
    setSelected(null);
  }, []);

  // ── Copy / paste ──────────────────────────────────────────────────────────
  const copyNode = useCallback((id: string) => {
    setNodes((current) => {
      setClipboard(collectSubtree(current, id));
      return current;
    });
  }, []);

  const pasteInto = useCallback(
    (phaseTempId: string, parentTempId: string | null) => {
      if (!clipboard || clipboard.length === 0) {
        return;
      }
      const clones = cloneSubtree(clipboard, clipboard[0].tempId, {
        newParentTempId: parentTempId,
        newPhaseTempId: phaseTempId,
        genId,
      });
      setNodes((n) => [...n, ...clones]);
      setSelected({ kind: "node", id: clones[0].tempId });
    },
    [clipboard, genId],
  );

  return {
    project,
    phases,
    nodes,
    selected,
    clipboard,
    setSelected,
    setProjectField,
    addPhase,
    updatePhase,
    removePhase,
    addNode,
    updateNode,
    removeNode,
    copyNode,
    pasteInto,
    suggestedChildType: SUGGESTED_CHILD_TYPE,
  };
}

export type BuilderState = ReturnType<typeof useBuilderState>;
