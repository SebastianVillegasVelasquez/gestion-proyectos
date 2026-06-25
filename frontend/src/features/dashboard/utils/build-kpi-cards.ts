import type { DashboardSummary, KpiCard } from "@/features/dashboard/types";

export function buildKpiCards(summary: DashboardSummary): KpiCard[] {
  return [
    {
      id: "active-projects",
      label: "PROYECTOS ACTIVOS",
      value: summary.active_projects,
      subtitle:
        summary.active_projects === 1 ? "1 en curso" : `${summary.active_projects} en curso`,
      accentColor: "blue",
    },
    {
      id: "completed-tasks",
      label: "TAREAS COMPLETADAS",
      value: summary.completed_tasks,
      subtitle: `de ${summary.total_tasks} totales`,
      accentColor: "emerald",
    },
    {
      id: "in-review",
      label: "EN REVISIÓN",
      value: summary.in_review_tasks,
      subtitle: summary.in_review_tasks === 0 ? "ninguna pendiente" : "requieren atención",
      accentColor: "amber",
    },
    {
      id: "overdue",
      label: "VENCIDAS",
      value: summary.overdue_tasks,
      subtitle: summary.overdue_tasks === 0 ? "todo al día" : "fuera de plazo",
      accentColor: "red",
    },
  ];
}

/** KPIs del dashboard del rol User: mismas métricas, acotadas a su información. */
export function buildMyKpiCards(summary: DashboardSummary): KpiCard[] {
  return [
    {
      id: "my-projects",
      label: "MIS PROYECTOS",
      value: summary.active_projects,
      subtitle:
        summary.active_projects === 1 ? "1 en curso" : `${summary.active_projects} en curso`,
      accentColor: "blue",
    },
    {
      id: "my-completed",
      label: "MIS TAREAS COMPLETADAS",
      value: summary.completed_tasks,
      subtitle: `de ${summary.total_tasks} asignadas`,
      accentColor: "emerald",
    },
    {
      id: "my-in-review",
      label: "EN REVISIÓN",
      value: summary.in_review_tasks,
      subtitle: summary.in_review_tasks === 0 ? "ninguna pendiente" : "requieren atención",
      accentColor: "amber",
    },
    {
      id: "my-overdue",
      label: "VENCIDAS",
      value: summary.overdue_tasks,
      subtitle: summary.overdue_tasks === 0 ? "todo al día" : "fuera de plazo",
      accentColor: "red",
    },
  ];
}
