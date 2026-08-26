import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ProjectHero } from "./detail/ProjectHero";
import { ProjectChartsCard } from "./detail/ProjectChartsCard";
import { UpcomingDeadlinesCard } from "./detail/UpcomingDeadlinesCard";
import type { Project, Task } from "../types/api.types";
import type { TaskMetrics } from "../utils/task-metrics";

vi.mock("react-router", () => ({ useNavigate: () => vi.fn() }));

// recharts mide su contenedor con ResizeObserver, que jsdom no trae. Sin este
// doble, montar el gráfico revienta antes de poder comprobar nada.
globalThis.ResizeObserver ??= class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
} as unknown as typeof ResizeObserver;

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const project = {
  id: "p1",
  name: "Diplomado",
  end_date: "2026-12-31",
} as Project;

const metrics: TaskMetrics = {
  total: 10,
  completed: 4,
  overdue: 2,
  progress: 40,
  status: "active",
} as TaskMetrics;

const emptyMetrics: TaskMetrics = {
  total: 0,
  completed: 0,
  overdue: 0,
  progress: 0,
  status: "active",
} as TaskMetrics;

const tasks: Task[] = [
  {
    id: "t1",
    title: "Grabar video",
    status: "pendiente_por_iniciar",
    due_date: "2026-09-01",
  } as Task,
];

describe("Detalle del proyecto · carga", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ProjectHero", () => {
    it("dibuja la caja y sus rótulos aunque no haya datos todavía", () => {
      render(<ProjectHero project={project} metrics={emptyMetrics} loading />, { wrapper });

      // La estructura está desde el principio: no es un rectángulo gris.
      expect(screen.getByText("Completadas")).toBeTruthy();
      expect(screen.getByText("Restantes")).toBeTruthy();
      expect(screen.getByText("Atrasadas")).toBeTruthy();
    });

    it("no enseña números inventados mientras carga", () => {
      render(<ProjectHero project={project} metrics={emptyMetrics} loading />, { wrapper });

      // Un 0% mientras se espera se lee como "el proyecto está a cero".
      expect(screen.queryByText("%")).toBeNull();
    });

    it("muestra los números al llegar los datos", () => {
      render(<ProjectHero project={project} metrics={metrics} />, { wrapper });

      expect(screen.getByText("40")).toBeTruthy();
      expect(screen.getByText(/4 de 10/)).toBeTruthy();
    });
  });

  describe("ProjectChartsCard", () => {
    it("mantiene la cabecera visible mientras carga", () => {
      render(<ProjectChartsCard tasks={[]} loading />, { wrapper });

      expect(screen.getByText("Tareas por estado")).toBeTruthy();
    });

    it("no pinta el gráfico hasta que llegan las tareas", async () => {
      const { rerender, container } = render(<ProjectChartsCard tasks={[]} loading />, {
        wrapper,
      });
      // Mientras carga hay hueco, no gráfico: pintar un aro vacío diría que el
      // proyecto no tiene tareas, que es distinto de "todavía no sé".
      expect(container.querySelector(".recharts-wrapper")).toBeNull();

      rerender(<ProjectChartsCard tasks={tasks} />);

      await waitFor(() => {
        expect(container.querySelector(".recharts-responsive-container")).toBeTruthy();
      });
    });
  });

  describe("UpcomingDeadlinesCard", () => {
    it("dibuja la caja con su título mientras carga", () => {
      render(<UpcomingDeadlinesCard projectId="p1" tasks={[]} loading />, { wrapper });

      expect(screen.getByText("Próximos vencimientos")).toBeTruthy();
      // Mientras carga NO se dice que no hay nada: todavía no se sabe.
      expect(screen.queryByText(/No hay tareas con fecha pendiente/i)).toBeNull();
    });

    it("solo dice que no hay vencimientos cuando ya se sabe", () => {
      render(<UpcomingDeadlinesCard projectId="p1" tasks={[]} />, { wrapper });

      expect(screen.getByText(/No hay tareas con fecha pendiente/i)).toBeTruthy();
    });

    it("lista los vencimientos al llegar", () => {
      render(<UpcomingDeadlinesCard projectId="p1" tasks={tasks} />, { wrapper });

      expect(screen.getByText("Grabar video")).toBeTruthy();
    });
  });
});
