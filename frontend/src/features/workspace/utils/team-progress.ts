import type { ApiTeamTask, ProjectTaskStatus } from "../api/workspace.api";
import type { Deliverable, DeliverableStatus } from "../types";
import { BOARD_STATUSES, isOverdue } from "./team-tasks";

export interface StatusSlice {
  status: ProjectTaskStatus;
  count: number;
  /** Porcentaje sobre el total de tareas (0-100, redondeado). */
  pct: number;
}

export interface TeamProgressSummary {
  totalTasks: number;
  /** Tareas completadas / (todas menos las canceladas). */
  completionPct: number;
  completedTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  /** Tareas en estado "en_revision": esperan al líder/supervisor. */
  awaitingReviewTasks: number;
  byStatus: StatusSlice[];
  deliverablesPendingReview: number;
  deliverablesApproved: number;
  deliverablesTotal: number;
}

const DELIVERABLE_PENDING: ReadonlySet<DeliverableStatus> = new Set<DeliverableStatus>([
  "en_revision",
]);

export function summarizeTeamProgress(
  tasks: ApiTeamTask[],
  deliverables: Deliverable[],
  today: string,
): TeamProgressSummary {
  const total = tasks.length;

  const statuses: ProjectTaskStatus[] = [...BOARD_STATUSES];
  if (tasks.some((t) => t.status === "cancelada")) {
    statuses.push("cancelada");
  }
  const byStatus: StatusSlice[] = statuses.map((status) => {
    const count = tasks.filter((t) => t.status === status).length;
    return { status, count, pct: total === 0 ? 0 : Math.round((count / total) * 100) };
  });

  const completedTasks = tasks.filter((t) => t.status === "completada").length;
  const cancelled = tasks.filter((t) => t.status === "cancelada").length;
  const denom = total - cancelled;

  return {
    totalTasks: total,
    completedTasks,
    completionPct: denom === 0 ? 0 : Math.round((completedTasks / denom) * 100),
    overdueTasks: tasks.filter((t) => isOverdue(t, today)).length,
    blockedTasks: tasks.filter((t) => t.blocked_by.some((b) => b.status !== "completada")).length,
    awaitingReviewTasks: tasks.filter((t) => t.status === "en_revision").length,
    byStatus,
    deliverablesPendingReview: deliverables.filter((d) => DELIVERABLE_PENDING.has(d.status)).length,
    deliverablesApproved: deliverables.filter((d) => d.status === "aprobado").length,
    deliverablesTotal: deliverables.length,
  };
}
