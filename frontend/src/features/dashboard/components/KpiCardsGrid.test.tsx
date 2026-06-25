import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiCardsGrid } from "./KpiCardsGrid";
import { buildKpiCards } from "../utils/build-kpi-cards";

const cards = buildKpiCards({
  active_projects: 4,
  total_tasks: 30,
  completed_tasks: 12,
  in_review_tasks: 5,
  overdue_tasks: 2,
});

describe("KpiCardsGrid", () => {
  it("renders the 4 KPI labels and values", () => {
    render(<KpiCardsGrid cards={cards} />);

    expect(screen.getByText("PROYECTOS ACTIVOS")).toBeInTheDocument();
    expect(screen.getByText("TAREAS COMPLETADAS")).toBeInTheDocument();
    expect(screen.getByText("EN REVISIÓN")).toBeInTheDocument();
    expect(screen.getByText("VENCIDAS")).toBeInTheDocument();

    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("de 30 totales")).toBeInTheDocument();
  });

  it("shows an error banner when isError is true", () => {
    render(<KpiCardsGrid cards={[]} isError />);
    expect(screen.getByRole("alert")).toHaveTextContent(/no se pudieron cargar/i);
    expect(screen.queryByText("PROYECTOS ACTIVOS")).not.toBeInTheDocument();
  });

  it("renders 4 skeletons (and no real labels) while loading", () => {
    const { container } = render(<KpiCardsGrid cards={[]} isLoading />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByText("PROYECTOS ACTIVOS")).not.toBeInTheDocument();
  });
});
