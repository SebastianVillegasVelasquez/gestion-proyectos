import { describe, it, expect } from "vitest";
import { buildKpiCards } from "./build-kpi-cards";
import type { DashboardSummary } from "../types";

const summary: DashboardSummary = {
  active_projects: 4,
  total_tasks: 30,
  completed_tasks: 12,
  in_review_tasks: 5,
  overdue_tasks: 2,
};

describe("buildKpiCards", () => {
  it("returns exactly 4 cards in fixed order: active, completed, review, overdue", () => {
    const cards = buildKpiCards(summary);
    expect(cards).toHaveLength(4);
    expect(cards.map((c) => c.id)).toEqual([
      "active-projects",
      "completed-tasks",
      "in-review",
      "overdue",
    ]);
  });

  it("maps summary numbers to card values", () => {
    const cards = buildKpiCards(summary);
    expect(cards[0].value).toBe(4);
    expect(cards[1].value).toBe(12);
    expect(cards[2].value).toBe(5);
    expect(cards[3].value).toBe(2);
  });

  it('shows "de N totales" on completed card with the total tasks', () => {
    const cards = buildKpiCards(summary);
    expect(cards[1].subtitle).toBe("de 30 totales");
  });

  it("shows reassuring copy when overdue and in-review are zero", () => {
    const cards = buildKpiCards({
      ...summary,
      in_review_tasks: 0,
      overdue_tasks: 0,
    });
    expect(cards[2].subtitle).toBe("ninguna pendiente");
    expect(cards[3].subtitle).toBe("todo al día");
  });

  it("pluralizes active projects subtitle correctly", () => {
    expect(buildKpiCards({ ...summary, active_projects: 1 })[0].subtitle).toBe("1 en curso");
    expect(buildKpiCards({ ...summary, active_projects: 7 })[0].subtitle).toBe("7 en curso");
  });
});
