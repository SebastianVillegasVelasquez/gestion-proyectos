import { Link } from "react-router";
import { ChevronRight, Users2 } from "lucide-react";
import type { Team } from "../../types/api.types";
import { teamInitials } from "../../utils/filter-teams";

// Tarjeta presentacional de un equipo: sin lógica de negocio, solo muestra los
// datos y enlaza a su detalle. El conteo de integrantes da contexto a simple
// vista (sin necesidad de entrar al equipo).
export function TeamCard({ team }: { team: Team }) {
  const memberCount = team.member_count;

  return (
    <Link
      to={`/teams/${team.id}`}
      aria-label={`Ver detalle del equipo ${team.name}`}
      className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-violet-700"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-sm font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
        {teamInitials(team.name)}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
          {team.name}
        </p>
        {team.description ? (
          <p className="truncate text-xs text-slate-400 dark:text-slate-500">{team.description}</p>
        ) : (
          <p className="text-xs italic text-slate-300 dark:text-slate-600">Sin descripción</p>
        )}
        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-violet-600 dark:text-violet-300">
          <Users2 className="size-3.5" />
          {memberCount} {memberCount === 1 ? "integrante" : "integrantes"}
        </p>
      </div>

      <ChevronRight className="size-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-500 dark:text-slate-600" />
    </Link>
  );
}
