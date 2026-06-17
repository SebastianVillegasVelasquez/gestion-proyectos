import { useMemo, useState } from "react";
import { UserPlus, Users, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectMembers } from "../../hooks/use-members";
import { memberInitials } from "../../utils/group-members";
import { PROJECT_ROLE_LABELS, PROJECT_ROLE_ACCENT } from "../../types/labels";
import type { ProjectMember, ProjectRole } from "../../types/api.types";
import { AddMemberModal } from "./AddMemberModal";

// Roles de liderazgo (pocos) vs integrantes (muchos).
const LEAD_ROLES: ProjectRole[] = ["coordinador", "supervisor", "revisor"];
const MEMBER_ROLES: ProjectRole[] = ["integrante", "cliente"];

function MemberRow({ member }: { member: ProjectMember }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
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
          {PROJECT_ROLE_LABELS[member.project_role]} · {member.position.replace(/_/g, " ")}
        </p>
      </div>
    </div>
  );
}

export function TeamPanel({ projectId }: { projectId: string }) {
  const membersQuery = useProjectMembers(projectId);
  const [showAdd, setShowAdd] = useState(false);

  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const leaders = members.filter((m) => LEAD_ROLES.includes(m.project_role));
  const team = members.filter((m) => MEMBER_ROLES.includes(m.project_role));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between">
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
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Izquierda: liderazgo (pocos) */}
          <section className="flex min-h-0 flex-col">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <Crown className="size-3.5 text-amber-500" /> Liderazgo
              <span className="rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-500 dark:bg-slate-800">
                {leaders.length}
              </span>
            </p>
            {leaders.length === 0 ? (
              <p className="text-sm italic text-slate-400">Sin líderes asignados.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {leaders.map((m) => (
                  <MemberRow key={m.user_id} member={m} />
                ))}
              </div>
            )}
          </section>

          {/* Derecha: integrantes (muchos, con scroll) */}
          <section className="flex min-h-0 flex-col">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <Users className="size-3.5 text-emerald-500" /> Integrantes
              <span className="rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-500 dark:bg-slate-800">
                {team.length}
              </span>
            </p>
            {team.length === 0 ? (
              <p className="text-sm italic text-slate-400">Aún no hay integrantes.</p>
            ) : (
              <div className="flex max-h-[22rem] min-h-0 flex-col gap-2 overflow-y-auto pr-1 lg:max-h-none lg:flex-1">
                {team.map((m) => (
                  <MemberRow key={m.user_id} member={m} />
                ))}
              </div>
            )}
          </section>
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
