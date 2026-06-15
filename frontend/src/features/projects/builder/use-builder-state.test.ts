import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBuilderState } from "./use-builder-state";

describe("useBuilderState", () => {
  it("adds a phase and selects it", () => {
    const { result } = renderHook(() => useBuilderState());
    act(() => {
      result.current.addPhase();
    });
    expect(result.current.phases).toHaveLength(1);
    expect(result.current.selected).toEqual({ kind: "phase", id: result.current.phases[0].tempId });
  });

  it("builds a node hierarchy under a phase", () => {
    const { result } = renderHook(() => useBuilderState());
    act(() => {
      result.current.addPhase();
    });
    const phaseId = result.current.phases[0].tempId;
    act(() => {
      result.current.addNode(phaseId, null, "PROGRAMA");
    });
    const programaId = result.current.nodes[0].tempId;
    act(() => {
      result.current.addNode(phaseId, programaId, "CURSO");
    });

    expect(result.current.nodes).toHaveLength(2);
    expect(result.current.nodes[1].parentTempId).toBe(programaId);
    expect(result.current.nodes[1].phaseTempId).toBe(phaseId);
  });

  it("copies a hierarchy and pastes it into another phase with fresh ids", () => {
    const { result } = renderHook(() => useBuilderState());
    act(() => {
      result.current.addPhase();
      result.current.addPhase();
    });
    const [phase1, phase2] = result.current.phases.map((p) => p.tempId);

    act(() => {
      result.current.addNode(phase1, null, "PROGRAMA");
    });
    const programaId = result.current.nodes[0].tempId;
    act(() => {
      result.current.addNode(phase1, programaId, "CURSO");
    });

    act(() => {
      result.current.copyNode(programaId);
    });
    expect(result.current.clipboard).toHaveLength(2);

    act(() => {
      result.current.pasteInto(phase2, null);
    });

    // Original 2 + pasted 2 = 4 nodes
    expect(result.current.nodes).toHaveLength(4);
    const pasted = result.current.nodes.filter((n) => n.phaseTempId === phase2);
    expect(pasted).toHaveLength(2);
    // No id collisions with the originals
    const originalIds = new Set([programaId, result.current.nodes[1].tempId]);
    expect(pasted.every((n) => !originalIds.has(n.tempId))).toBe(true);
  });

  it("removing a phase removes its nodes", () => {
    const { result } = renderHook(() => useBuilderState());
    act(() => {
      result.current.addPhase();
    });
    const phaseId = result.current.phases[0].tempId;
    act(() => {
      result.current.addNode(phaseId, null, "PROGRAMA");
    });
    act(() => {
      result.current.removePhase(phaseId);
    });
    expect(result.current.phases).toHaveLength(0);
    expect(result.current.nodes).toHaveLength(0);
  });
});
