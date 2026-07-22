import { useMemo, useState } from "react";
import { UsersRound, Search } from "lucide-react";
import { LoadingSkeleton, ErrorState, EmptyState } from "@/components/common/AsyncStates";
import { useTeams } from "../../hooks/use-teams";
import { filterTeams } from "../../utils/filter-teams";
import { TeamCard } from "./TeamCard";

// Apartado "Equipos de trabajo" del detalle de proyecto. Lista los equipos
// predefinidos que existen en el sistema; cada uno enlaza a su detalle.
// La lógica de filtrado vive en `filterTeams` (pura, testeada aparte); aquí
// solo orquestamos datos, estados (carga/error/vacío) y presentación.
export function WorkTeamsPanel() {
  const teamsQuery = useTeams();
  const [search, setSearch] = useState("");

  const teams = useMemo(() => teamsQuery.data?.items ?? [], [teamsQuery.data]);
  const filtered = useMemo(() => filterTeams(teams, search), [teams, search]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <UsersRound className="size-4 text-violet-500" /> Equipos de trabajo
          <span className="rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-500 dark:bg-slate-800">
            {teams.length}
          </span>
        </h2>
      </div>

      <p className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
        Equipos reutilizables del sistema. Entra a un equipo para ver sus integrantes.
      </p>

      {/* Búsqueda por nombre o descripción */}
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
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-violet-500/20"
        />
      </div>

      {teamsQuery.isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : teamsQuery.isError ? (
        <ErrorState
          title="No se pudieron cargar los equipos"
          hint="Hubo un problema al obtener los equipos de trabajo."
          onRetry={() => void teamsQuery.refetch()}
        />
      ) : teams.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="Aún no hay equipos de trabajo"
          hint="Cuando se creen equipos en el sistema, aparecerán aquí para consultarlos."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Sin resultados"
          hint={`Ningún equipo coincide con «${search}».`}
        />
      ) : (
        // content-start evita que el grid estire las filas para llenar la altura
        // (las cards se deformaban cuando había pocos equipos).
        <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      )}
    </div>
  );
}
