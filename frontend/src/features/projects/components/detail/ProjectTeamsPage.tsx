import { useMemo, useState } from "react";
import { ChevronLeft, Pencil, Plus, Search, Trash2, Users, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingSkeleton, ErrorState, EmptyState } from "@/components/common/AsyncStates";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { getErrorMessage } from "@/utils/get-error-message";
import { useDeleteTeam, useTeams } from "../../hooks/use-teams";
import { filterTeams } from "../../utils/filter-teams";
import { colorForName } from "../../utils/entity-color";
import type { Team } from "../../types/api.types";
import { TeamFormModal } from "../teams/TeamFormModal";
import { TeamMembersManager } from "../teams/TeamMembersManager";

// El avance de un equipo se calcula igual que el avance individual: tareas
// completadas sobre asignadas de todos sus integrantes (las tareas son las
// hojas del árbol de la estructura del proyecto, así que el avance por
// equipo también refleja la completación de módulos/cursos asignados).
function TeamRow({ team, onOpen }: { team: Team; onOpen: () => void }) {
  const pct = Math.round(team.completion_pct);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-brand-gold/40 hover:shadow-lg sm:flex-row sm:items-center sm:gap-5"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            colorForName(team.name),
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

      <div className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-muted-foreground sm:w-32">
        <Users className="size-3.5" />
        {team.member_count} {team.member_count === 1 ? "integrante" : "integrantes"}
      </div>

      <div className="flex shrink-0 items-center gap-2.5 sm:w-56">
        <div className="h-2 min-w-[100px] flex-1 overflow-hidden rounded-full bg-accent">
          <div
            className="h-full rounded-full bg-brand-blue transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="w-10 shrink-0 text-right text-xs font-bold tabular-nums text-brand-blue-dark dark:text-brand-blue">
          {pct}%
        </span>
      </div>

      <span className="shrink-0 text-[11px] font-semibold text-muted-foreground sm:w-24 sm:text-right">
        {team.completed_tasks}/{team.assigned_tasks} tareas
      </span>
    </button>
  );
}

// Equipos de trabajo del proyecto: se crean dentro de este proyecto y no existen
// fuera de él. Vista en lista, con el avance de cada equipo (misma fórmula que
// el avance individual); al abrir un equipo se entra a su detalle (integrantes)
// con un botón para volver a la lista.
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

  // Detalle de un equipo: reemplaza la lista, con retroceso a ella.
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
                colorForName(open.name),
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
              <div className="mt-2 flex items-center gap-2.5">
                <div className="h-2 w-40 overflow-hidden rounded-full bg-accent">
                  <div
                    className="h-full rounded-full bg-brand-blue transition-all"
                    style={{ width: `${Math.round(open.completion_pct)}%` }}
                  />
                </div>
                <span className="text-xs font-bold tabular-nums text-brand-blue-dark dark:text-brand-blue">
                  {Math.round(open.completion_pct)}%
                </span>
                <span className="text-xs text-muted-foreground">
                  ({open.completed_tasks}/{open.assigned_tasks} tareas)
                </span>
              </div>
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
          <div className="flex flex-col gap-3">
            {filtered.map((team) => (
              <TeamRow
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
              className="flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-border text-muted-foreground transition-colors hover:border-brand-gold/60 hover:text-foreground"
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
