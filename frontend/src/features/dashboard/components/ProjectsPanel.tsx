import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "./StatusBadge";
import type { Project } from "../types";

const MAX_VISIBLE = 3;

function getBarColor(pct: number): string {
  if (pct >= 70) {
    return "bg-emerald-500";
  }
  if (pct >= 40) {
    return "bg-amber-400";
  }
  return "bg-red-500";
}

function getTextColor(pct: number): string {
  if (pct >= 70) {
    return "text-emerald-600 dark:text-emerald-400";
  }
  if (pct >= 40) {
    return "text-amber-600 dark:text-amber-400";
  }
  return "text-red-600 dark:text-red-400";
}

function ProjectRow({ project, href }: { project: Project; href?: string }) {
  const className = cn(
    "flex flex-col gap-1.5 rounded-md border p-2.5 transition-colors duration-150",
    "border-slate-200 bg-slate-50 hover:border-slate-300",
    "dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600",
    href && "hover:border-brand-gold/50 dark:hover:border-brand-gold/50",
  );
  const inner = (
    <>
      {/* Name + tech badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[12px] font-medium text-slate-800 dark:text-slate-100">
          {project.name}
        </span>
        <span className="inline-flex shrink-0 items-center rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          {project.techBadge}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <StatusBadge variant={project.status} />
        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          {project.tasksCompleted}/{project.tasksTotal}
        </span>
      </div>

      <p className="text-[10px] text-slate-400 dark:text-slate-500">
        <span className="text-slate-500 dark:text-slate-400">{project.coordinator}</span>
      </p>

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div
            className={cn(
              "h-full transition-all duration-300",
              getBarColor(project.progressPercent),
            )}
            style={{ width: `${project.progressPercent}%` }}
          />
        </div>
        <span
          className={cn(
            "text-[10px] font-medium tabular-nums",
            getTextColor(project.progressPercent),
          )}
        >
          {project.progressPercent}%
        </span>
      </div>
    </>
  );

  return href ? (
    <Link to={href} className={className}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}

interface ProjectsPanelProps {
  projects: Project[];
  /** Si se provee, cada proyecto enlaza a su vista de progreso (rol User). */
  getProjectHref?: (project: Project) => string;
}

export function ProjectsPanel({ projects, getProjectHref }: ProjectsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? projects : projects.slice(0, MAX_VISIBLE);
  const hasMore = projects.length > MAX_VISIBLE;

  return (
    <Card className="flex flex-1 min-h-0 flex-col">
      <CardHeader className="shrink-0 pb-2">
        <CardTitle className="text-sm font-semibold">Proyectos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 min-h-0 flex-col gap-2 overflow-y-auto">
        {visible.map((project) => (
          <ProjectRow key={project.id} project={project} href={getProjectHref?.(project)} />
        ))}

        {hasMore && (
          <button
            type="button"
            onClick={() => {
              setExpanded((v) => !v);
            }}
            className="mt-1 flex w-full items-center justify-center gap-1 rounded-md border border-slate-200 py-1.5 text-[11px] font-medium text-slate-500 transition-colors duration-150 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200"
          >
            {expanded ? "Ver menos" : "Ver más"}
            {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
