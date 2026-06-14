// ─── Shared ───────────────────────────────────────────────────────────────────

export type AccentColor = "amber" | "emerald" | "blue" | "red";

// ─── Header ───────────────────────────────────────────────────────────────────

export interface DashboardHeaderData {
  name: string;
  date: string;
  tasksToday: number;
  tasksTodayTotal: number;
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────

export interface KpiCard {
  id: string;
  label: string;
  value: string | number;
  subtitle: string;
  accentColor: AccentColor;
}

// ─── Dashboard summary (API contract) ─────────────────────────────────────────

export interface DashboardSummary {
  active_projects: number;
  total_tasks: number;
  completed_tasks: number;
  in_review_tasks: number;
  overdue_tasks: number;
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export type TaskStatus = "pending" | "in-progress" | "completed";

export type TagVariant = "project" | "date";

export interface TaskTag {
  label: string;
  variant: TagVariant;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  tags: TaskTag[];
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export type ProjectStatus = "active" | "at-risk" | "in-review";

export interface Project {
  id: string;
  name: string;
  techBadge: string;
  status: ProjectStatus;
  coordinator: string;
  tasksTotal: number;
  tasksCompleted: number;
  progressPercent: number;
}

// ─── Deadlines ────────────────────────────────────────────────────────────────

export type Priority = "today" | "high" | "medium" | "low";

export interface Deadline {
  id: string;
  day: number;
  month: string;
  title: string;
  project: string;
  priority: Priority;
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  authorInitials: string;
  authorColor: string;
  authorName: string;
  timestamp: string;
  text: string;
  mentions: string[];
  project: string;
  section: string;
  isUnread: boolean;
}
