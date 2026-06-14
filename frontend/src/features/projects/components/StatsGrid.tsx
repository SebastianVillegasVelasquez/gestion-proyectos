import { Network, Users, Clock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import type { BuilderNode, ProjectFormData, ProjectMember } from "../types";

function daysRemaining(endDate: string): number | null {
  if (!endDate) {
    return null;
  }
  const diff = new Date(endDate).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function DaysLabel({ days }: { days: number | null }) {
  if (days === null) {
    return <span className="text-slate-400 dark:text-slate-500">Sin fecha</span>;
  }
  if (days < 0) {
    return <span className="text-red-600 dark:text-red-400">Vencido ({Math.abs(days)}d)</span>;
  }
  if (days === 0) {
    return <span className="text-red-600 dark:text-red-400">Vence hoy</span>;
  }
  return <span>{days}</span>;
}

function DaysUnit({ days }: { days: number | null }) {
  if (days === null || days < 0 || days === 0) {
    return null;
  }
  return <span>días</span>;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  unit?: React.ReactNode;
  accent: string;
}

function StatCard({ icon, label, value, unit, accent }: StatCardProps) {
  return (
    <Card className={cn("border-b-2 transition-colors duration-150", accent)}>
      <CardContent className="flex items-center gap-4 pt-5 pb-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {label}
          </p>
          <p className="mt-0.5 text-2xl font-bold text-slate-900 dark:text-slate-50">
            {value}
            {unit && (
              <span className="ml-1 text-sm font-medium text-slate-400 dark:text-slate-500">
                {unit}
              </span>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface StatsGridProps {
  project: ProjectFormData & { progress_pct?: number };
  nodes: BuilderNode[];
  members: ProjectMember[];
}

export function StatsGrid({ project, nodes, members }: StatsGridProps) {
  const days = daysRemaining(project.end_date);
  const pct = project.progress_pct ?? 0;

  const daysAccent =
    days === null
      ? "border-b-slate-300 dark:border-b-slate-700"
      : days < 0
        ? "border-b-red-400"
        : days <= 7
          ? "border-b-amber-400"
          : "border-b-emerald-400";

  return (
    <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        icon={<Network className="size-5 text-violet-500" />}
        label="Nodos"
        value={nodes.length}
        unit={nodes.length !== 1 ? "nodos" : "nodo"}
        accent="border-b-violet-400"
      />
      <StatCard
        icon={<Users className="size-5 text-blue-500" />}
        label="Equipo"
        value={members.length}
        unit={members.length !== 1 ? "miembros" : "miembro"}
        accent="border-b-blue-400"
      />
      <StatCard
        icon={<Clock className="size-5 text-amber-500" />}
        label="Días restantes"
        value={<DaysLabel days={days} />}
        unit={<DaysUnit days={days} />}
        accent={daysAccent}
      />
      <StatCard
        icon={<TrendingUp className="size-5 text-emerald-500" />}
        label="Progreso"
        value={`${pct}%`}
        accent={
          pct >= 70
            ? "border-b-emerald-400"
            : pct >= 40
              ? "border-b-amber-400"
              : "border-b-slate-300 dark:border-b-slate-700"
        }
      />
    </div>
  );
}
