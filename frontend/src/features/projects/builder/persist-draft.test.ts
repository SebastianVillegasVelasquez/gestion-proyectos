import { describe, it, expect, vi } from "vitest";
import { persistDraft, orderByDepth } from "./persist-draft";
import type { DraftNode, DraftPhase, DraftProject } from "./draft.types";

function draftNode(
  tempId: string,
  parentTempId: string | null,
  phaseTempId: string | null = null,
): DraftNode {
  return {
    tempId,
    name: tempId,
    node_type: "MODULO",
    type_label: "",
    phaseTempId,
    parentTempId,
    end_date: "",
  };
}

describe("orderByDepth", () => {
  it("orders parents before children regardless of input order", () => {
    const ordered = orderByDepth([draftNode("c", "b"), draftNode("a", null), draftNode("b", "a")]);
    expect(ordered.map((n) => n.tempId)).toEqual(["a", "b", "c"]);
  });
});

describe("persistDraft", () => {
  const project: DraftProject = {
    name: "Demo",
    description: "",
    client_name: "ACME",
    start_date: "",
    end_date: "",
  };

  function makeCreators() {
    let phaseSeq = 0;
    let nodeSeq = 0;
    return {
      createProject: vi.fn().mockResolvedValue({ id: "proj-1" }),
      createPhase: vi.fn().mockImplementation((_pid: string) => {
        phaseSeq += 1;
        return Promise.resolve({ id: `phase-${phaseSeq}` });
      }),
      createNode: vi.fn().mockImplementation(() => {
        nodeSeq += 1;
        return Promise.resolve({ id: `node-${nodeSeq}` });
      }),
    };
  }

  it("creates project, then phases, then nodes and maps temp ids to real ids", async () => {
    const phases: DraftPhase[] = [
      { tempId: "ph-a", name: "Fase 1", duration_days: "10", start_date: "", end_date: "" },
    ];
    const nodes: DraftNode[] = [
      draftNode("n-child", "n-root", "ph-a"),
      draftNode("n-root", null, "ph-a"),
    ];

    const creators = makeCreators();
    const result = await persistDraft(project, phases, nodes, creators);

    expect(result.id).toBe("proj-1");

    // Phase created with numeric duration and project id
    expect(creators.createPhase).toHaveBeenCalledWith("proj-1", {
      name: "Fase 1",
      duration_days: 10,
      start_date: null,
      end_date: null,
    });

    // Root node created before child, with real phase id
    const firstNodeCall = creators.createNode.mock.calls[0][0];
    const secondNodeCall = creators.createNode.mock.calls[1][0];
    expect(firstNodeCall.name).toBe("n-root");
    expect(firstNodeCall.parent_id).toBeNull();
    expect(firstNodeCall.phase_id).toBe("phase-1");

    // Child references the real id of the root created first
    expect(secondNodeCall.name).toBe("n-child");
    expect(secondNodeCall.parent_id).toBe("node-1");
  });

  it("sends null for empty optional fields", async () => {
    const creators = makeCreators();
    await persistDraft(project, [], [], creators);
    expect(creators.createProject).toHaveBeenCalledWith({
      name: "Demo",
      description: null,
      client_name: "ACME",
      start_date: null,
      end_date: null,
    });
  });

  it("leaves duration null when not provided", async () => {
    const creators = makeCreators();
    const phases: DraftPhase[] = [
      { tempId: "ph", name: "Fase", duration_days: "", start_date: "2026-09-01", end_date: "" },
    ];
    await persistDraft(project, phases, [], creators);
    expect(creators.createPhase).toHaveBeenCalledWith("proj-1", {
      name: "Fase",
      duration_days: null,
      start_date: "2026-09-01",
      end_date: null,
    });
  });
});
