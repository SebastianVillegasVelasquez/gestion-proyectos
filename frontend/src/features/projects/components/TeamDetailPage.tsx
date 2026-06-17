import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, UsersRound, Briefcase, Users2, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { LoadingSkeleton, ErrorState, EmptyState } from "@/components/common/AsyncStates";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { getErrorMessage } from "@/utils/get-error-message";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Role } from "@/features/auth/types";
import { useTeam, useTeamMembers, useDeleteTeam } from "../hooks/use-teams";
import { groupTeamMembersByRole, teamMemberInitials } from "../utils/group-team-members";
import { TEAM_ROLE_LABELS, TEAM_ROLE_ACCENT, positionLabel } from "../types/labels";
import type { TeamMember } from "../types/api.types";
import { EditTeamModal } from "./detail/EditTeamModal";

function MemberRow({ member }: { member: TeamMember }) {
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
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
          TEAM_ROLE_ACCENT[member.team_role],
        )}
      >
        {TEAM_ROLE_LABELS[member.team_role]}
      </span>
    </div>
  );
}

function TeamMembersList({ teamId }: { teamId: string }) {
  const membersQuery = useTeamMembers(teamId);
  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const groups = useMemo(() => groupTeamMembersByRole(members), [members]);

  if (membersQuery.isLoading) {
    return <LoadingSkeleton rows={4} />;
  }
  if (membersQuery.isError) {
    return (
      <ErrorState
        title="No se pudieron cargar los integrantes"
        onRetry={() => void membersQuery.refetch()}
      />
    );
  }
  if (members.length === 0) {
    return (
      <EmptyState
        icon={Users2}
        title="Este equipo aún no tiene integrantes"
        hint="Cuando se agreguen personas al equipo, aparecerán aquí agrupadas por rol."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <section key={group.role} className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {TEAM_ROLE_LABELS[group.role]}
            <span className="rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-500 dark:bg-slate-800">
              {group.members.length}
            </span>
          </p>
          {group.members.map((m) => (
            <MemberRow key={m.user_id} member={m} />
          ))}
        </section>
      ))}
    </div>
  );
}

export function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const teamQuery = useTeam(teamId);
  const deleteTeam = useDeleteTeam();

  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  // Solo administración global gestiona equipos predefinidos. El backend además
  // lo refuerza (403), pero ocultar las acciones evita intentos inútiles.
  const canManage = hasRole([Role.ADMIN, Role.SUPER_ADMIN]);

  const team = teamQuery.data;

  const handleDelete = () => {
    if (!team) {
      return;
    }
    deleteTeam.mutate(team.id, {
      onSuccess: () => {
        setShowDelete(false);
        void navigate(-1);
      },
    });
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      <button
        type="button"
        onClick={() => void navigate(-1)}
        className="flex w-fit items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
      >
        <ArrowLeft className="size-3.5" /> Volver
      </button>

      {teamQuery.isLoading ? (
        <LoadingSkeleton rows={2} />
      ) : teamQuery.isError || !team ? (
        <ErrorState
          title="Equipo no encontrado"
          hint="Es posible que haya sido eliminado o que no tengas acceso."
          onRetry={() => void teamQuery.refetch()}
        />
      ) : (
        <>
          <header className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">
              <UsersRound className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                {team.name}
              </h1>
              {team.description && (
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  {team.description}
                </p>
              )}
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-violet-600 dark:text-violet-300">
                <Users2 className="size-3.5" />
                {team.member_count} {team.member_count === 1 ? "integrante" : "integrantes"}
              </p>
            </div>

            {canManage && (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEdit(true);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Pencil className="size-3.5" /> Editar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDelete(true);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                >
                  <Trash2 className="size-3.5" /> Eliminar
                </button>
              </div>
            )}
          </header>

          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Integrantes</h2>

          {/* Frontera de errores: si el render de la lista fallara, aislamos el
              fallo a esta sección en vez de tumbar toda la página. */}
          <ErrorBoundary
            fallbackTitle="No se pudieron mostrar los integrantes"
            fallbackHint="Ocurrió un error al renderizar la lista. Intenta recargar la página."
          >
            <TeamMembersList teamId={teamId!} />
          </ErrorBoundary>

          {showEdit && (
            <EditTeamModal
              team={team}
              onClose={() => {
                setShowEdit(false);
              }}
            />
          )}

          {showDelete && (
            <ConfirmDialog
              destructive
              title="Eliminar equipo"
              message={`¿Seguro que quieres eliminar «${team.name}»? Los proyectos que ya lo usaron conservan sus integrantes; el equipo dejará de estar disponible para nuevas asignaciones.`}
              confirmLabel="Eliminar"
              loading={deleteTeam.isPending}
              errorMessage={
                deleteTeam.isError
                  ? getErrorMessage(deleteTeam.error, "No se pudo eliminar el equipo")
                  : null
              }
              onConfirm={handleDelete}
              onCancel={() => {
                setShowDelete(false);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
