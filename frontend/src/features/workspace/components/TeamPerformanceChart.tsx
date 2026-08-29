import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import type { ApiTeamMember, ApiTeamTask } from "../api/workspace.api";
import { performanceByMember, type MemberPerformance } from "../utils/team-tasks";

// Cada métrica del filtro: de qué campo sale la barra, su color y si es un %.
type MetricKey = "completed" | "overdue" | "open" | "completionPct";

const METRICS: {
  key: MetricKey;
  label: string;
  color: string;
  percent?: boolean;
  /** true → mejor cuanto más alto (ordena descendente igualmente, pero lo usamos en el texto). */
}[] = [
  { key: "completed", label: "Completadas", color: "var(--color-brand-teal, #4da0b1)" },
  { key: "overdue", label: "Vencidas", color: "var(--color-brand-red, #c4573a)" },
  { key: "open", label: "Abiertas", color: "var(--color-brand-gold, #e4b54f)" },
  {
    key: "completionPct",
    label: "% avance",
    color: "var(--color-brand-teal, #4da0b1)",
    percent: true,
  },
];

const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? full;

interface Row extends MemberPerformance {
  name: string;
  short: string;
  value: number;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) {
    return null;
  }
  const r = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground">{r.name}</p>
      <div className="mt-1 flex flex-col gap-0.5 text-muted-foreground">
        <span>
          {r.completed} completadas de {r.total}
        </span>
        <span>
          {r.open} abiertas · {r.inReview} en revisión
        </span>
        <span className={cn(r.overdue > 0 && "font-semibold text-rose-500")}>
          {r.overdue} vencidas
        </span>
        <span>{r.completionPct}% de avance</span>
      </div>
    </div>
  );
}

/**
 * Rendimiento del equipo persona por persona, en barras. El filtro cambia la
 * métrica (completadas / vencidas / abiertas / % de avance) y siempre se ordena
 * de mayor a menor: de un vistazo se ve quién va mejor y quién va atrasado.
 */
export function TeamPerformanceChart({
  tasks,
  teamMembers,
  today,
}: {
  tasks: ApiTeamTask[];
  teamMembers: ApiTeamMember[];
  today: string;
}) {
  const [metricKey, setMetricKey] = useState<MetricKey>("completed");
  const metric = METRICS.find((m) => m.key === metricKey) ?? METRICS[0];

  const perf = useMemo(
    () =>
      performanceByMember(
        tasks,
        teamMembers.map((m) => m.user_id),
        today,
      ),
    [tasks, teamMembers, today],
  );

  const rows = useMemo<Row[]>(() => {
    return teamMembers
      .map((m) => {
        const name = `${m.name} ${m.last_name}`.trim();
        const p = perf[m.user_id];
        return { ...p, name, short: firstName(name), value: p[metricKey] };
      })
      .sort((a, b) => b.value - a.value);
  }, [teamMembers, perf, metricKey]);

  const everythingZero = rows.every((r) => r.value === 0);

  return (
    <div>
      {/* Filtro de métrica */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => {
              setMetricKey(m.key);
            }}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
              metricKey === m.key
                ? "bg-brand-teal text-white dark:bg-brand-teal"
                : "bg-accent text-muted-foreground hover:text-foreground",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {everythingZero ? (
        <p className="py-6 text-center text-[12px] italic text-muted-foreground">
          Sin datos para «{metric.label}» todavía.
        </p>
      ) : (
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis
                dataKey="short"
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                domain={metric.percent ? [0, 100] : [0, "auto"]}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                width={34}
              />
              <Tooltip
                cursor={{ fill: "var(--color-accent)", opacity: 0.5 }}
                content={<ChartTooltip />}
                wrapperStyle={{ outline: "none" }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={44} animationDuration={450}>
                {rows.map((r) => (
                  <Cell key={r.userId} fill={metric.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
