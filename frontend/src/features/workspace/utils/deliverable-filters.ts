import type { Deliverable, DeliverableStatus } from "../types";

export interface DeliverableFilters {
  /** Búsqueda por título del entregable (insensible a mayúsculas). */
  text: string;
  status: DeliverableStatus | "all";
  /** WorkspaceMember.id del responsable, o el centinela "all". */
  assignee: string;
}

export const EMPTY_DELIVERABLE_FILTERS: DeliverableFilters = {
  text: "",
  status: "all",
  assignee: "all",
};

export function filterDeliverables(
  deliverables: Deliverable[],
  filters: DeliverableFilters,
): Deliverable[] {
  const needle = filters.text.trim().toLowerCase();
  return deliverables.filter((d) => {
    if (needle && !d.taskTitle.toLowerCase().includes(needle)) {
      return false;
    }
    if (filters.status !== "all" && d.status !== filters.status) {
      return false;
    }
    if (filters.assignee !== "all" && d.assigneeId !== filters.assignee) {
      return false;
    }
    return true;
  });
}

export function activeDeliverableFilterCount(filters: DeliverableFilters): number {
  let n = 0;
  if (filters.text.trim()) {
    n += 1;
  }
  if (filters.status !== "all") {
    n += 1;
  }
  if (filters.assignee !== "all") {
    n += 1;
  }
  return n;
}
