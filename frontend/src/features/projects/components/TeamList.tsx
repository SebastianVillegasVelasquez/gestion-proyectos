import { Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { ProjectMember, ProjectRole } from "../types";
import { PROJECT_ROLE_LABELS } from "../types";

// Role ordering and badge styles
const ROLE_ORDER: ProjectRole[] = ["coordinador", "integrante", "revisor"];

const ROLE_BADGE: Record<ProjectRole, string> = {
  coordinador:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-400",
  integrante:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400",
  revisor:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
};

function MemberRow({
  member,
  onRemove,
}: {
  member: ProjectMember;
  onRemove?: (id: string) => void;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-slate-100 dark:hover:bg-slate-800/50">
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white",
          member.avatarColor,
        )}
        aria-hidden="true"
      >
        {member.initials}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-slate-800 dark:text-slate-200">
          {member.name}
        </p>
      </div>

      {/* Role badge */}
      <span
        className={cn(
          "shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
          ROLE_BADGE[member.role],
        )}
      >
        {PROJECT_ROLE_LABELS[member.role]}
      </span>

      {/* Remove button (hover) */}
      {onRemove && (
        <button
          type="button"
          onClick={() => {
            onRemove(member.id);
          }}
          title={`Eliminar a ${member.name}`}
          aria-label={`Eliminar a ${member.name}`}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-300 opacity-0 transition-all duration-150 hover:bg-red-100 hover:text-red-500 group-hover:opacity-100 dark:text-slate-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}

interface TeamListProps {
  members: ProjectMember[];
  onRemove?: (id: string) => void;
}

export function TeamList({ members, onRemove }: TeamListProps) {
  // Group by role respecting ROLE_ORDER
  const groups = ROLE_ORDER.map((role) => ({
    role,
    members: members.filter((m) => m.role === role),
  })).filter((g) => g.members.length > 0);

  return (
    <Card className="flex min-h-0 flex-1 flex-col">
      <CardHeader className="shrink-0 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-slate-400 dark:text-slate-500" />
          <CardTitle className="text-sm font-semibold">Equipo del proyecto</CardTitle>
          {members.length > 0 && (
            <span className="ml-auto rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              {members.length}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col overflow-y-auto p-2">
        {groups.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
            <Users className="size-8 text-slate-300 dark:text-slate-700" />
            <p className="text-[12px] text-slate-400 dark:text-slate-500">Sin miembros asignados</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map(({ role, members: groupMembers }) => (
              <div key={role}>
                {/* Group header */}
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {PROJECT_ROLE_LABELS[role]}s
                </p>
                {groupMembers.map((m) => (
                  <MemberRow key={m.id} member={m} onRemove={onRemove} />
                ))}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
