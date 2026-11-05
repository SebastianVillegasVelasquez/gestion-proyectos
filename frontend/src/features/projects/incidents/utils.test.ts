import { describe, expect, it } from "vitest";
import type { ProjectIncident } from "./types";
import { addDaysToIso, formatIncidentDate, summarizeIncidents } from "./utils";

function incident(overrides: Partial<ProjectIncident>): ProjectIncident {
  return {
    id: "i",
    project_id: "p",
    title: "t",
    description: null,
    email_body: null,
    responsible: "cliente",
    incident_date: "2026-03-10",
    impact_days: 0,
    client_response_date: null,
    client_response_days: null,
    applied_days: null,
    applied_at: null,
    is_applied: false,
    author_name: null,
    created_at: "2026-03-10T00:00:00Z",
    attachments: [],
    ...overrides,
  };
}

describe("summarizeIncidents", () => {
  it("separates applied from pending days", () => {
    const summary = summarizeIncidents([
      incident({ impact_days: 2, is_applied: true, applied_days: 2 }),
      incident({ impact_days: 3 }),
      incident({ impact_days: 0 }),
    ]);
    expect(summary).toMatchObject({
      total: 3,
      impactDays: 5,
      appliedDays: 2,
      pendingDays: 3,
      pendingCount: 1,
    });
  });

  it("averages only the incidents the client already answered", () => {
    const summary = summarizeIncidents([
      incident({ client_response_days: 2 }),
      incident({ client_response_days: 5 }),
      incident({}),
    ]);
    expect(summary.avgClientResponseDays).toBe(3.5);
  });

  it("has no response average when nobody answered", () => {
    expect(summarizeIncidents([incident({})]).avgClientResponseDays).toBeNull();
  });
});

describe("date helpers", () => {
  it("adds days across month boundaries", () => {
    expect(addDaysToIso("2026-06-30", 2)).toBe("2026-07-02");
    expect(addDaysToIso("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("formats an ISO date for display", () => {
    expect(formatIncidentDate("2026-03-10")).toBe("10 mar 2026");
  });
});
