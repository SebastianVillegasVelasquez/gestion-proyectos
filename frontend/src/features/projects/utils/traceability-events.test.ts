import { describe, it, expect } from "vitest";
import {
  EMPTY_TRACE_FILTERS,
  TRACE_EVENT_LABELS,
  TRACE_FILTER_LABELS,
  type TraceFilterGroup,
  type TraceabilityFilters,
  filterTraceabilityEvents,
  teamsInTimeline,
} from "./traceability-events";
import type { TraceabilityEvent, TraceabilityEventKind } from "../types/api.types";

function event(
  kind: TraceabilityEventKind,
  overrides: Partial<TraceabilityEvent> = {},
): TraceabilityEvent {
  return {
    id: kind,
    task_id: "t1",
    task_title: "Tarea",
    actor_name: "Ana García",
    action: "cambio_estado",
    old_status: null,
    new_status: null,
    change_reason: null,
    old_value: null,
    new_value: null,
    created_at: "2026-02-01T10:00:00Z",
    kind,
    is_delay: false,
    ...overrides,
  };
}

/** Atajo: parte de "sin filtros" y cambia solo lo que interesa a cada caso. */
function filters(overrides: Partial<TraceabilityFilters> = {}): TraceabilityFilters {
  return { ...EMPTY_TRACE_FILTERS, ...overrides };
}

const ALL_KINDS: TraceabilityEventKind[] = [
  "creacion",
  "asignacion",
  "inicio",
  "entrega",
  "aprobacion",
  "devolucion",
  "cancelacion",
  "comentario",
  "cambio_estado",
  "equipo",
  "ubicacion",
  "reprogramacion",
  "prioridad",
];

describe("TRACE_EVENT_LABELS", () => {
  it("has a label for every event kind used in the UI", () => {
    for (const kind of ALL_KINDS) {
      expect(TRACE_EVENT_LABELS[kind]).toBeTruthy();
    }
  });
});

describe("filterTraceabilityEvents", () => {
  const events = [
    event("inicio", { id: "a", is_delay: true }),
    event("entrega", { id: "b" }),
    event("devolucion", { id: "c" }),
    event("cambio_estado", { id: "d", is_delay: true }),
    event("equipo", { id: "e", team_id: "team-1", team_name: "Contenidos" }),
    event("reprogramacion", { id: "f" }),
  ];

  it("returns every event with the default filters", () => {
    expect(filterTraceabilityEvents(events, EMPTY_TRACE_FILTERS)).toHaveLength(events.length);
  });

  it("keeps only delays in the 'retrasos' group", () => {
    const result = filterTraceabilityEvents(events, filters({ group: "retrasos" }));
    expect(result.map((e) => e.id)).toEqual(["a", "d"]);
  });

  it("groups handover events under 'reparto'", () => {
    const result = filterTraceabilityEvents(events, filters({ group: "reparto" }));
    expect(result.map((e) => e.kind)).toEqual(["equipo"]);
  });

  it("narrows to a single team", () => {
    const result = filterTraceabilityEvents(events, filters({ teamId: "team-1" }));
    expect(result.map((e) => e.id)).toEqual(["e"]);
  });

  it("searches by task title and actor, ignoring case", () => {
    const named = [
      event("inicio", { id: "x", task_title: "Guion de Unidad 1" }),
      event("inicio", { id: "y", task_title: "Montaje", actor_name: "Bruno Díaz" }),
    ];
    expect(filterTraceabilityEvents(named, filters({ search: "guion" }))).toHaveLength(1);
    expect(filterTraceabilityEvents(named, filters({ search: "BRUNO" }))).toHaveLength(1);
  });

  it("combines group and team without losing either condition", () => {
    const result = filterTraceabilityEvents(
      events,
      filters({ group: "reparto", teamId: "team-2" }),
    );
    expect(result).toEqual([]);
  });

  it("has a label for every filter group", () => {
    for (const group of Object.keys(TRACE_FILTER_LABELS) as TraceFilterGroup[]) {
      expect(TRACE_FILTER_LABELS[group]).toBeTruthy();
    }
  });
});

describe("teamsInTimeline", () => {
  it("lists each team once, sorted by name, ignoring events without team", () => {
    const events = [
      event("equipo", { id: "1", team_id: "t-2", team_name: "Producción" }),
      event("equipo", { id: "2", team_id: "t-1", team_name: "Contenidos" }),
      event("equipo", { id: "3", team_id: "t-2", team_name: "Producción" }),
      event("inicio", { id: "4" }),
    ];
    expect(teamsInTimeline(events)).toEqual([
      { id: "t-1", name: "Contenidos" },
      { id: "t-2", name: "Producción" },
    ]);
  });
});
