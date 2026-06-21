import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkspaceMember } from "../types";

interface WorkspaceHeaderProps {
  name: string;
  description: string;
  members: WorkspaceMember[];
  canDeliver: boolean;
  onNewDeliverable: () => void;
}

export function WorkspaceHeader({
  name,
  description,
  members,
  canDeliver,
  onNewDeliverable,
}: WorkspaceHeaderProps) {
  const leader = members.find((m) => m.role === "lider");
  const others = members.filter((m) => m.id !== leader?.id);
  const visible = others.slice(0, 4);
  const hiddenCount = others.length - visible.length;

  return (
    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-bold text-slate-900 dark:text-slate-50">{name}</h1>
        {description && (
          <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <div className="flex items-center">
          {leader && (
            <div className="relative" title={`${leader.name} (Líder)`}>
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-white ring-2 ring-white dark:ring-slate-900",
                  leader.avatarColor,
                )}
              >
                {leader.initials}
              </span>
              <span className="absolute -top-1 -right-0.5 text-[10px]">👑</span>
            </div>
          )}

          {visible.map((m, i) => (
            <span
              key={m.id}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900",
                m.avatarColor,
              )}
              style={{ marginLeft: i === 0 && leader ? "-4px" : "-10px" }}
              title={m.name}
            >
              {m.initials}
            </span>
          ))}

          {hiddenCount > 0 && (
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[10px] font-semibold text-slate-600 ring-2 ring-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-900"
              style={{ marginLeft: "-10px" }}
              title={`${hiddenCount} integrantes más`}
            >
              +{hiddenCount}
            </span>
          )}

          <span className="ml-3 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {members.length} integrantes
          </span>
        </div>

        {canDeliver && (
          <button
            type="button"
            onClick={onNewDeliverable}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-brand-gold-dark"
          >
            <Plus className="size-3.5" />
            Nuevo entregable
          </button>
        )}
      </div>
    </div>
  );
}
