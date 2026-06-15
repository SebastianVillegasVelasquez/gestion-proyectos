import { useState } from "react";
import { UserPlus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { useProjectMembers } from "../../hooks/use-members";
import { groupMembersByRole, memberInitials } from "../../utils/group-members";
import { PROJECT_ROLE_LABELS, PROJECT_ROLE_ACCENT } from "../../types/labels";
import { AddMemberModal } from "./AddMemberModal";

export function TeamPanel({ projectId }: { projectId: string }) {
  const membersQuery = useProjectMembers(projectId);
  const [showAdd, setShowAdd] = useState(false);

  const groups = groupMembersByRole(membersQuery.data ?? []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Users className="size-4 text-slate-400" /> Equipo de trabajo
        </h2>
        <button
          type="button"
          onClick={() => {
            setShowAdd(true);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
        >
          <UserPlus className="size-3.5" /> Agregar integrante
        </button>
      </div>

      {membersQuery.isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
      ) : membersQuery.isError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
        >
          No se pudo cargar el equipo.
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-200 py-10 text-center dark:border-slate-700">
          <Users className="size-8 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Aún no hay integrantes en este proyecto.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <div key={group.role}>
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {PROJECT_ROLE_LABELS[group.role]}
                <span className="rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-500 dark:bg-slate-800">
                  {group.members.length}
                </span>
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.members.map((member) => (
                  <Card key={member.user_id}>
                    <CardContent className="flex items-center gap-3 py-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                          PROJECT_ROLE_ACCENT[member.project_role],
                        )}
                      >
                        {memberInitials(member)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                          {member.name} {member.last_name}
                        </p>
                        <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                          {member.position.replace(/_/g, " ")}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddMemberModal
          projectId={projectId}
          onClose={() => {
            setShowAdd(false);
          }}
        />
      )}
    </div>
  );
}
