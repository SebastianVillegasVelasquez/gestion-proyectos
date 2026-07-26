import { useMemo, useState } from "react";
import { Briefcase, Trash2, UserPlus, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingSkeleton, ErrorState, EmptyState } from "@/components/common/AsyncStates";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { getErrorMessage } from "@/utils/get-error-message";
import {
  useChangeTeamMemberRole,
  useRemoveTeamMember,
  useTeamMembers,
} from "../../hooks/use-teams";
import { teamMemberInitials } from "../../utils/group-team-members";
import {
  TEAM_ROLE_ACCENT,
  TEAM_ROLE_LABELS,
  TEAM_ROLE_ORDER,
  positionLabel,
} from "../../types/labels";
import type { TeamMember, TeamRole } from "../../types/api.types";
import { AddTeamMemberModal } from "./AddTeamMemberModal";

function MemberRow({
  member,
  projectId,
  teamId,
}: {
  member: TeamMember;
  projectId: string;
  teamId: string;
}) {
  const changeRole = useChangeTeamMemberRole(projectId, teamId);
  const removeMember = useRemoveTeamMember(projectId, teamId);
  const [confirmRemove, setConfirmRemove] = useState(false);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          TEAM_ROLE_ACCENT[member.team_role],
        )}
      >
        {teamMemberInitials(member)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
          {member.name} {member.last_name}
        </p>
        <p className="flex items-center gap-1 truncate text-xs text-slate-400 dark:text-slate-500">
          <Briefcase className="size-3 shrink-0" />
          {positionLabel(member.position)}
        </p>
      </div>

      <select
        value={member.team_role}
        disabled={changeRole.isPending}
        aria-label={`Rol de ${member.name}`}
        onChange={(e) => {
          changeRole.mutate({ userId: member.user_id, teamRole: e.target.value as TeamRole });
        }}
        className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 outline-none focus:border-violet-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
      >
        {TEAM_ROLE_ORDER.map((r) => (
          <option key={r} value={r}>
            {TEAM_ROLE_LABELS[r]}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => {
          setConfirmRemove(true);
        }}
        aria-label={`Quitar a ${member.name}`}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
      >
        <Trash2 className="size-4" />
      </button>

      {confirmRemove && (
        <ConfirmDialog
          destructive
          title="Quitar integrante"
          message={`¿Quitar a ${member.name} ${member.last_name} del equipo?`}
          confirmLabel="Quitar"
          loading={removeMember.isPending}
          errorMessage={
            removeMember.isError
              ? getErrorMessage(removeMember.error, "No se pudo quitar al integrante")
              : null
          }
          onConfirm={() => {
            removeMember.mutate(member.user_id, {
              onSuccess: () => {
                setConfirmRemove(false);
              },
            });
          }}
          onCancel={() => {
            setConfirmRemove(false);
          }}
        />
      )}
    </div>
  );
}

// Gestión de integrantes de un equipo: listar, agregar, cambiar rol y quitar.
export function TeamMembersManager({ projectId, teamId }: { projectId: string; teamId: string }) {
  const membersQuery = useTeamMembers(projectId, teamId);
  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const existingIds = useMemo(() => members.map((m) => m.user_id), [members]);
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Users2 className="size-4 text-violet-500" /> Integrantes
          <span className="rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-500 dark:bg-slate-800">
            {members.length}
          </span>
        </h3>
        <button
          type="button"
          onClick={() => {
            setShowAdd(true);
          }}
          className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-700"
        >
          <UserPlus className="size-3.5" /> Agregar
        </button>
      </div>

      {membersQuery.isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : membersQuery.isError ? (
        <ErrorState
          title="No se pudieron cargar los integrantes"
          onRetry={() => void membersQuery.refetch()}
        />
      ) : members.length === 0 ? (
        <EmptyState
          icon={Users2}
          title="Este equipo aún no tiene integrantes"
          hint="Usa «Agregar» para sumar personas al equipo."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {members.map((m) => (
            <MemberRow key={m.user_id} member={m} projectId={projectId} teamId={teamId} />
          ))}
        </div>
      )}

      {showAdd && (
        <AddTeamMemberModal
          projectId={projectId}
          teamId={teamId}
          existingIds={existingIds}
          onClose={() => {
            setShowAdd(false);
          }}
        />
      )}
    </div>
  );
}
