import { useMemo } from "react";
import { CalendarOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "../types";
import { STATUS_BAR_COLOR } from "../types";
import type { BuilderNode, ProjectMember } from "../../types";

// ── layout constants ───────────────────────────────────────────────────────

const LABEL_W = 220; // px — sticky left column
const DAY_COL_W = 36; // px/day in day mode
const WEEK_COL_W = 80; // px/week in week mode
const ROW_H = 44; // px per task row
const HEADER_H = 52; // px for the time column header
const GROUP_H = 30; // px for node group header rows

// ── date helpers ───────────────────────────────────────────────────────────

function parseDate(s: string): Date | null {
  if (!s) {
    return null;
  }
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isoWeekNum(d: Date): number {
  const tmp = new Date(d);
  tmp.setHours(0, 0, 0, 0);
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const yearStart = new Date(tmp.getFullYear(), 0, 4);
  return (
    Math.round(
      ((tmp.getTime() - yearStart.getTime()) / 86_400_000 - 3 + ((yearStart.getDay() + 6) % 7)) / 7,
    ) + 1
  );
}

// ── grouping ───────────────────────────────────────────────────────────────

function groupTasks(
  tasks: Task[],
  nodes: BuilderNode[],
): { id: string; name: string; tasks: Task[] }[] {
  const byNode = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = task.node_id || "__none__";
    if (!byNode.has(key)) {
      byNode.set(key, []);
    }
    byNode.get(key)!.push(task);
  }

  const groups: { id: string; name: string; tasks: Task[] }[] = [];
  for (const node of nodes) {
    if (byNode.has(node.id)) {
      groups.push({
        id: node.id,
        name: node.name || "Nodo sin nombre",
        tasks: byNode.get(node.id)!,
      });
    }
  }
  if (byNode.has("__none__")) {
    groups.push({
      id: "__none__",
      name: "Sin nodo asignado",
      tasks: byNode.get("__none__")!,
    });
  }
  return groups;
}

// ── empty state ────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
        <CalendarOff className="size-5 text-slate-400 dark:text-slate-500" />
      </div>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No hay tareas aún</p>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Crea la primera tarea con el botón "Nueva tarea".
      </p>
    </div>
  );
}

// ── component ─────────────────────────────────────────────────────────────

interface CustomGanttViewerProps {
  tasks: Task[];
  nodes: BuilderNode[];
  members: ProjectMember[];
  onClickTask: (task: Task) => void;
}

export function CustomGanttViewer({ tasks, nodes, members, onClickTask }: CustomGanttViewerProps) {
  if (tasks.length === 0) {
    return <EmptyState />;
  }

  // ── chart range ──────────────────────────────────────────────────────────
  const datedTasks = tasks.filter((t) => t.start_date && t.due_date);

  const { chartStart, totalDays } = useMemo(() => {
    if (datedTasks.length === 0) {
      const t = new Date();
      t.setHours(0, 0, 0, 0);
      return { chartStart: t, totalDays: 30 };
    }
    const starts = datedTasks.map((t) => parseDate(t.start_date)!);
    const ends = datedTasks.map((t) => parseDate(t.due_date)!);
    const start = new Date(Math.min(...starts.map((d) => d.getTime())));
    const end = new Date(Math.max(...ends.map((d) => d.getTime())));
    return { chartStart: start, totalDays: Math.max(daysBetween(start, end) + 1, 7) };
  }, [datedTasks]);

  const useWeeks = totalDays > 45;
  const totalColumnDays = useWeeks ? Math.ceil(totalDays / 7) * 7 : totalDays;
  const colW = useWeeks ? WEEK_COL_W : DAY_COL_W;
  const numCols = useWeeks ? totalColumnDays / 7 : totalColumnDays;
  const chartW = numCols * colW;

  // ── today marker ─────────────────────────────────────────────────────────
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const todayOffset = daysBetween(chartStart, today);
  const showToday = todayOffset >= 0 && todayOffset <= totalColumnDays;
  const todayLeft = LABEL_W + (todayOffset / totalColumnDays) * chartW;

  // ── header columns ───────────────────────────────────────────────────────
  const columns = useMemo(() => {
    return Array.from({ length: numCols }, (_, i) => {
      const d = addDays(chartStart, i * (useWeeks ? 7 : 1));
      if (useWeeks) {
        const month = d.toLocaleString("es-CO", { month: "short" });
        return { top: `S${isoWeekNum(d)}`, bottom: month };
      }
      const day = d.getDate();
      const isMonthStart = day === 1 || i === 0;
      return {
        top: String(day),
        bottom: isMonthStart ? d.toLocaleString("es-CO", { month: "short" }) : "",
      };
    });
  }, [chartStart, numCols, useWeeks]);

  // ── groups ────────────────────────────────────────────────────────────────
  const groups = useMemo(() => groupTasks(tasks, nodes), [tasks, nodes]);

  // ── bar helper ────────────────────────────────────────────────────────────
  const getBar = (task: Task) => {
    if (!task.start_date || !task.due_date) {
      return null;
    }
    const start = parseDate(task.start_date)!;
    const end = parseDate(task.due_date)!;
    const startOffset = daysBetween(chartStart, start);
    const duration = daysBetween(start, end) + 1;
    const leftPct = (startOffset / totalColumnDays) * 100;
    const widthPct = Math.max((duration / totalColumnDays) * 100, 0.4);
    return { left: `${leftPct}%`, width: `${widthPct}%` };
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative h-full overflow-auto">
      {/* Inner canvas — wider than viewport when needed */}
      <div style={{ width: LABEL_W + chartW, minWidth: "100%", position: "relative" }}>
        {/* ─ Header row (sticky top) ─ */}
        <div
          className="sticky top-0 z-20 flex border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
          style={{ height: HEADER_H }}
        >
          {/* Label header — sticky left */}
          <div
            className="sticky left-0 z-30 flex shrink-0 items-end border-r border-slate-200 bg-white pb-2 pl-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500"
            style={{ width: LABEL_W }}
          >
            Tarea
          </div>

          {/* Time column headers */}
          <div
            className="relative flex shrink-0 bg-white dark:bg-slate-900"
            style={{ width: chartW }}
          >
            {columns.map((col, i) => (
              <div
                key={i}
                className="relative flex shrink-0 flex-col items-center justify-end border-r border-slate-100 pb-1.5 dark:border-slate-800"
                style={{ width: colW, height: HEADER_H }}
              >
                <span className="text-[10px] font-medium leading-none text-slate-600 dark:text-slate-300">
                  {col.top}
                </span>
                {col.bottom && (
                  <span className="mt-0.5 text-[9px] leading-none text-slate-400 dark:text-slate-500">
                    {col.bottom}
                  </span>
                )}
              </div>
            ))}
            {/* Today dot in header */}
            {showToday && (
              <div
                className="pointer-events-none absolute bottom-0 top-0 z-10 flex flex-col items-center"
                style={{ left: (todayOffset / totalColumnDays) * chartW - 1 }}
              >
                <div className="w-0.5 flex-1 bg-blue-500/80" />
              </div>
            )}
          </div>
        </div>

        {/* Today line spanning full body height */}
        {showToday && (
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-blue-400/25"
            style={{ left: todayLeft }}
          />
        )}

        {/* ─ Groups ─ */}
        {groups.map((group) => (
          <div key={group.id}>
            {/* Group header — sticky below column header */}
            <div
              className="sticky flex border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60"
              style={{ top: HEADER_H, height: GROUP_H, zIndex: 15 }}
            >
              <div
                className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r border-slate-200 bg-slate-50 pl-4 pr-2 dark:border-slate-700 dark:bg-slate-800/60"
                style={{ width: LABEL_W }}
              >
                <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {group.name}
                </span>
                <span className="ml-auto shrink-0 rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                  {group.tasks.length}
                </span>
              </div>
              <div className="flex-1" style={{ width: chartW }} />
            </div>

            {/* Task rows */}
            {group.tasks.map((task, rowIdx) => {
              const bar = getBar(task);
              const member = members.find((m) => m.id === task.assignee_id);
              const isEven = rowIdx % 2 === 0;

              return (
                <div
                  key={task.id}
                  className={cn(
                    "group flex border-b border-slate-100 transition-colors duration-75 hover:bg-blue-50/50 dark:border-slate-800/60 dark:hover:bg-blue-950/10",
                    isEven ? "bg-white dark:bg-slate-900" : "bg-slate-50/60 dark:bg-slate-900/60",
                  )}
                  style={{ height: ROW_H }}
                >
                  {/* Label cell — sticky left */}
                  <div
                    className={cn(
                      "sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-slate-100 px-3 transition-colors duration-75 dark:border-slate-800/60",
                      isEven ? "bg-white dark:bg-slate-900" : "bg-slate-50/60 dark:bg-slate-900/60",
                      "group-hover:bg-blue-50/50 dark:group-hover:bg-blue-950/10",
                    )}
                    style={{ width: LABEL_W }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onClickTask(task);
                      }}
                      className="min-w-0 flex-1 truncate text-left text-[13px] text-slate-700 transition-colors hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-400"
                      title={task.title}
                    >
                      {task.title}
                    </button>
                    {member && (
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white",
                          member.avatarColor,
                        )}
                        title={member.name}
                      >
                        {member.initials}
                      </span>
                    )}
                  </div>

                  {/* Time cell */}
                  <div className="relative shrink-0" style={{ width: chartW, height: ROW_H }}>
                    {bar ? (
                      <button
                        type="button"
                        onClick={() => {
                          onClickTask(task);
                        }}
                        className={cn(
                          "absolute rounded transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
                          STATUS_BAR_COLOR[task.status],
                        )}
                        style={{
                          left: bar.left,
                          width: bar.width,
                          top: "28%",
                          height: "44%",
                          minWidth: 6,
                        }}
                        title={`${task.title} · ${task.start_date} → ${task.due_date}`}
                      />
                    ) : (
                      <span className="absolute inset-y-0 left-2 flex items-center text-[11px] italic text-slate-300 dark:text-slate-700">
                        Sin fechas
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
