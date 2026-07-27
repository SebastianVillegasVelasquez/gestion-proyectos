import { useMemo, useState } from "react";
import { ChevronLeft, Pencil, Plus, Search, Trash2, Users, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingSkeleton, ErrorState, EmptyState } from "@/components/common/AsyncStates";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { getErrorMessage } from "@/utils/get-error-message";
import { useDeleteTeam, useTeams } from "../../hooks/use-teams";
import { filterTeams } from "../../utils/filter-teams";
import type { Team } from "../../types/api.types";
import { TeamFormModal } from "../teams/TeamFormModal";
import { TeamMembersManager } from "../teams/TeamMembersManager";

// Color determinístico por nombre de equipo: el mismo equipo se reconoce con el
// mismo acento en cualquier pantalla (patrón pedido en el handoff). Se usan los
// tintes de la paleta de la marca, no índigo del prototipo.
const TEAM_PALETTE = [
  "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300",
  "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
  "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-300",
  "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300",
];

function teamColor(name: string): string {
  let hash = 0;
  for (const ch of name) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return TEAM_PALETTE[hash % TEAM_PALETTE.length];
}

function TeamCard({ team, onOpen }: { team: Team; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col gap-3.5 rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-brand-gold/40 hover:shadow-lg"
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            teamColor(team.name),
          )}
        >
          <UsersRound className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15.5px] font-bold text-foreground">{team.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {team.description ?? "Equipo de trabajo del proyecto"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 border-t border-accent/70 pt-3 text-xs font-semibold text-muted-foreground">
        <Users className="size-3.5" />
        {team.member_count} {team.member_count === 1 ? "integrante" : "integrantes"}
      </div>
    </button>
  );
}

// Equipos de trabajo del proyecto: se crean dentro de este proyecto y no existen
// fuera de él. Vista en grid (cada equipo es una tarjeta); al abrir un equipo se
// entra a su detalle (integrantes) con un botón para volver al grid.
export function ProjectTeamsPage({ projectId }: { projectId: string }) {
  const teamsQuery = useTeams(projectId);
  const deleteTeam = useDeleteTeam(projectId);

  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [deleting, setDeleting] = useState<Team | null>(null);

  const teams = useMemo(() => teamsQuery.data?.items ?? [], [teamsQuery.data]);
  const filtered = useMemo(() => filterTeams(teams, search), [teams, search]);

  const open = useMemo(() => teams.find((t) => t.id === openId) ?? null, [teams, openId]);

  const handleDelete = () => {
    if (!deleting) {
      return;
    }
    deleteTeam.mutate(deleting.id, {
      onSuccess: () => {
        setDeleting(null);
        setOpenId(null);
      },
    });
  };

  // Detalle de un equipo: reemplaza el grid, con retroceso a la lista.
  if (open) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
        <button
          type="button"
          onClick={() => {
            setOpenId(null);
          }}
          className="flex shrink-0 items-center gap-1.5 self-start text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
          Equipos de trabajo
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-card p-5">
          <header className="flex items-start gap-3">
            <div
              className={cn(
                "flex size-12 shrink-0 items-center justify-center rounded-2xl",
                teamColor(open.name),
              )}
            >
              <UsersRound className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">
                {open.name}
              </h2>
              {open.description && (
                <p className="mt-0.5 text-sm text-muted-foreground">{open.description}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditing(open);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
              >
                <Pencil className="size-3.5" /> Editar
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleting(open);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                <Trash2 className="size-3.5" /> Eliminar
              </button>
            </div>
          </header>

          <div className="mt-5">
            <TeamMembersManager projectId={projectId} teamId={open.id} />
          </div>
        </div>

        {editing && (
          <TeamFormModal
            projectId={projectId}
            team={editing}
            onClose={() => {
              setEditing(null);
            }}
          />
        )}

        {deleting && (
          <ConfirmDialog
            destructive
            title="Eliminar equipo"
            message={`¿Seguro que quieres eliminar «${deleting.name}»? Esta acción no se puede deshacer.`}
            confirmLabel="Eliminar"
            loading={deleteTeam.isPending}
            errorMessage={
              deleteTeam.isError
                ? getErrorMessage(deleteTeam.error, "No se pudo eliminar el equipo")
                : null
            }
            onConfirm={handleDelete}
            onCancel={() => {
              setDeleting(null);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      {/* Toolbar: buscador + crear equipo */}
      <div className="flex shrink-0 flex-wrap items-center gap-2.5">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            placeholder="Buscar equipo…"
            aria-label="Buscar equipo"
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
          />
        </div>
        <span className="hidden flex-1 sm:block" />
        <button
          type="button"
          onClick={() => {
            setShowCreate(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-brand-gold-dark"
        >
          <Plus className="size-4" /> Crear equipo
        </button>
      </div>

      {teamsQuery.isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : teamsQuery.isError ? (
        <ErrorState
          title="No se pudieron cargar los equipos"
          onRetry={() => void teamsQuery.refetch()}
        />
      ) : filtered.length === 0 && teams.length > 0 ? (
        <EmptyState
          icon={Search}
          title="Sin resultados"
          hint={`Ningún equipo coincide con «${search}».`}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filtered.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                onOpen={() => {
                  setOpenId(team.id);
                }}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                setShowCreate(true);
              }}
              className="flex min-h-[132px] flex-col items-center justify-center gap-2.5 rounded-2xl border-[1.5px] border-dashed border-border text-muted-foreground transition-colors hover:border-brand-gold/60 hover:text-foreground"
            >
              <Plus className="size-5" />
              <span className="text-sm font-bold">Crear equipo</span>
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <TeamFormModal
          projectId={projectId}
          onClose={() => {
            setShowCreate(false);
          }}
          onCreated={(team) => {
            setOpenId(team.id);
          }}
        />
      )}
    </div>
  );
}
