import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingSkeleton, ErrorState, EmptyState } from "@/components/common/AsyncStates";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { getErrorMessage } from "@/utils/get-error-message";
import { useDeleteTeam, useTeams } from "../../hooks/use-teams";
import { filterTeams } from "../../utils/filter-teams";
import type { Team } from "../../types/api.types";
import { EditTeamModal } from "../detail/EditTeamModal";
import { CreateTeamModal } from "./CreateTeamModal";
import { TeamMembersManager } from "./TeamMembersManager";

// Vista de gestión de equipos para administración (rol admin/super_admin).
// Master-detail: a la izquierda la lista de equipos (buscar, crear, seleccionar);
// a la derecha la configuración del equipo elegido (editar, eliminar, integrantes).
export function TeamsManagementPage() {
  const teamsQuery = useTeams();
  const deleteTeam = useDeleteTeam();

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [deleting, setDeleting] = useState<Team | null>(null);

  const teams = useMemo(() => teamsQuery.data?.items ?? [], [teamsQuery.data]);
  const filtered = useMemo(() => filterTeams(teams, search), [teams, search]);

  // El equipo activo: el seleccionado (si sigue en la lista) o el primero.
  const selected = useMemo(
    () => filtered.find((t) => t.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  const handleDelete = () => {
    if (!deleting) {
      return;
    }
    deleteTeam.mutate(deleting.id, {
      onSuccess: () => {
        setDeleting(null);
        setSelectedId(null);
      },
    });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden p-4 sm:p-6">
      <PageHeader
        title="Equipos de trabajo"
        description="Crea, configura y administra los equipos del sistema y sus integrantes."
        actions={
          <button
            type="button"
            onClick={() => {
              setShowCreate(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-brand-gold-dark"
          >
            <Plus className="size-4" /> Nuevo equipo
          </button>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr]">
        {/* Master: lista de equipos */}
        <div className="flex min-h-0 flex-col gap-3">
          <div className="relative shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              placeholder="Buscar equipo…"
              aria-label="Buscar equipo"
              className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 dark:focus:ring-violet-500/20"
            />
          </div>

          {teamsQuery.isLoading ? (
            <LoadingSkeleton rows={4} />
          ) : teamsQuery.isError ? (
            <ErrorState
              title="No se pudieron cargar los equipos"
              onRetry={() => void teamsQuery.refetch()}
            />
          ) : teams.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title="Aún no hay equipos"
              hint="Crea el primer equipo con «Nuevo equipo»."
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Sin resultados"
              hint={`Ningún equipo coincide con «${search}».`}
            />
          ) : (
            <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
              {filtered.map((team) => (
                <li key={team.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(team.id);
                    }}
                    aria-current={selected?.id === team.id ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition",
                      selected?.id === team.id
                        ? "border-violet-300 bg-violet-50 dark:border-violet-500/40 dark:bg-violet-900/20"
                        : "border-border bg-card hover:bg-accent",
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">
                      <UsersRound className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {team.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {team.member_count} {team.member_count === 1 ? "integrante" : "integrantes"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Detalle: configuración del equipo seleccionado */}
        <div className="min-h-0 overflow-y-auto rounded-xl border border-border bg-card p-5">
          {selected ? (
            <div className="flex flex-col gap-5">
              <header className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">
                  <UsersRound className="size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">
                    {selected.name}
                  </h2>
                  {selected.description && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{selected.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(selected);
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                  >
                    <Pencil className="size-3.5" /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleting(selected);
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="size-3.5" /> Eliminar
                  </button>
                </div>
              </header>

              <TeamMembersManager teamId={selected.id} />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <EmptyState
                icon={UsersRound}
                title="Selecciona un equipo"
                hint="Elige un equipo de la izquierda para configurarlo, o crea uno nuevo."
              />
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateTeamModal
          onClose={() => {
            setShowCreate(false);
          }}
          onCreated={(team) => {
            setSelectedId(team.id);
          }}
        />
      )}

      {editing && (
        <EditTeamModal
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
          message={`¿Seguro que quieres eliminar «${deleting.name}»? Los proyectos que ya lo usaron conservan sus integrantes; el equipo dejará de estar disponible para nuevas asignaciones.`}
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
