import { describe, it, expect } from "vitest";
import { TRACE_EVENT_LABELS, filterTraceabilityEvents } from "./traceability-events";
import type { TraceabilityEvent, TraceabilityEventKind } from "../types/api.types";

function event(
  kind: TraceabilityEventKind,
  is_delay = false,
  id = `${kind}-${is_delay}`,
): TraceabilityEvent {
  return {
    id,
    task_id: "t1",
    task_title: "Tarea",
    actor_name: "Ana García",
    action: "cambio_estado",
    old_status: null,
    new_status: null,
    change_reason: null,
    created_at: "2026-02-01T10:00:00Z",
    kind,
    is_delay,
  };
}

describe("TRACE_EVENT_LABELS", () => {
  it("has a label for every event kind used in the UI", () => {
    const kinds: TraceabilityEventKind[] = [
      "creacion",
      "asignacion",
      "inicio",
      "entrega",
      "aprobacion",
      "devolucion",
      "cancelacion",
      "comentario",
      "cambio_estado",
    ];
    for (const k of kinds) {
      expect(TRACE_EVENT_LABELS[k]).toBeTruthy();
    }
  });
});

describe("filterTraceabilityEvents", () => {
  const events = [
    event("inicio", true, "a"),
    event("entrega", false, "b"),
    event("devolucion", false, "c"),
    event("cambio_estado", true, "d"),
  ];

  it("returns all events when onlyDelays is false", () => {
    expect(filterTraceabilityEvents(events, false)).toHaveLength(4);
  });

  it("keeps only delay events when onlyDelays is true", () => {
    const result = filterTraceabilityEvents(events, true);
    expect(result.map((e) => e.id)).toEqual(["a", "d"]);
  });

  it("returns an empty array when there are no delays", () => {
    expect(filterTraceabilityEvents([event("entrega", false)], true)).toEqual([]);
  });
});
