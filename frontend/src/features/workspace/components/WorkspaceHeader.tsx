import { Plus, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkspaceGroup } from "../types";
import { TEAM_ROLE_LABELS } from "../types";

interface WorkspaceHeaderProps {
  group: WorkspaceGroup;
  currentUserId: string;
  onChangeCurrentUser: (id: string) => void;
  onNewTask: () => void;
}

export function WorkspaceHeader({
  group,
  currentUserId,
  onChangeCurrentUser,
  onNewTask,
}: WorkspaceHeaderProps) {
  const leader = group.members.find((m) => m.id === group.leaderId);
  const others = group.members.filter((m) => m.id !== group.leaderId);
  const overflow = others.length > 4;
  const visible = others.slice(0, 4);
  const hiddenCount = others.length - visible.length;

  return (
    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
      {/* Group info */}
      <div className="min-w-0">
        <h1 className="truncate text-lg font-bold text-slate-900 dark:text-slate-50">
          {group.name}
        </h1>
        <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
          {group.description}
        </p>
      </div>

      {/* Right cluster: avatars + CTA */}
      <div className="flex shrink-0 items-center gap-4">
        {/* Member avatars */}
        <div className="flex items-center">
          {/* Leader — highlighted */}
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
              {/* Crown indicator */}
              <span className="absolute -top-1 -right-0.5 text-[10px]">👑</span>
            </div>
          )}

          {/* Other members */}
          {visible.map((m, i) => (
            <span
              key={m.id}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900",
                m.avatarColor,
              )}
              style={{ marginLeft: i === 0 ? "-4px" : "-10px" }}
              title={m.name}
            >
              {m.initials}
            </span>
          ))}

          {/* Overflow count */}
          {overflow && hiddenCount > 0 && (
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[10px] font-semibold text-slate-600 ring-2 ring-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-900"
              style={{ marginLeft: "-10px" }}
              title={`${hiddenCount} miembros más`}
            >
              +{hiddenCount}
            </span>
          )}

          {/* Member count chip */}
          <span className="ml-3 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {group.members.length} miembros
          </span>
        </div>

        {/* "Actuar como" — simula el miembro actual para validar permisos por rol */}
        <label className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] dark:border-slate-700 dark:bg-slate-800">
          <UserCog className="size-3.5 text-slate-400" />
          <span className="text-slate-400 dark:text-slate-500">Actuar como</span>
          <select
            value={currentUserId}
            onChange={(e) => {
              onChangeCurrentUser(e.target.value);
            }}
            className="bg-transparent font-medium text-slate-700 outline-none dark:text-slate-200"
          >
            {group.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {TEAM_ROLE_LABELS[m.role]}
              </option>
            ))}
          </select>
        </label>

        {/* CTA */}
        <button
          type="button"
          onClick={onNewTask}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-brand-gold-dark"
        >
          <Plus className="size-3.5" />
          Nueva Tarea de Grupo
        </button>
      </div>
    </div>
  );
}
