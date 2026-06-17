import { useMemo, useState } from "react";
import { useNavigate, useOutletContext } from "react-router";
import { ChevronLeft, ChevronRight, Moon, Search, Sun, User, Users } from "lucide-react";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import { LoadingSkeleton, ErrorState, EmptyState } from "@/components/common/AsyncStates";
import { positionLabel } from "@/features/projects/types/labels";
import { useDebouncedValue } from "@/features/projects/utils/use-debounced-value";
import { useCollaborators } from "../hooks/use-collaborators";
import { personInitials, totalPages } from "../utils/completion";
import type { CollaboratorListItem } from "../types";
import { CompletionBar } from "./CompletionBar";

const PAGE_SIZE = 10;

function CollaboratorRow({
  collaborator,
  onOpen,
}: {
  collaborator: CollaboratorListItem;
  onOpen: () => void;
}) {
  const fullName = `${collaborator.name} ${collaborator.last_name}`;
  return (
    <tr
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={`Ver actividad de ${fullName}`}
      className="cursor-pointer border-t border-slate-100 transition-colors hover:bg-blue-50/40 focus:outline-none focus-visible:bg-blue-50/60 dark:border-slate-800 dark:hover:bg-blue-950/20"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            {personInitials(collaborator.name, collaborator.last_name)}
          </span>
          <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
            {fullName}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {positionLabel(collaborator.position)}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="w-44">
          <CompletionBar
            pct={collaborator.completion_pct}
            completed={collaborator.completed_tasks}
            assigned={collaborator.assigned_tasks}
          />
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
          Ver detalle <ChevronRight className="size-3.5" />
        </span>
      </td>
    </tr>
  );
}

export function CollaboratorsPage() {
  const { dark, toggleDark } = useOutletContext<AppOutletContext>();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  // Al escribir reiniciamos la paginación a la primera página (en el handler,
  // no en un efecto: el cambio de página es consecuencia directa de teclear).
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const query = useCollaborators({
    search: debouncedSearch || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const items = useMemo(() => query.data?.items ?? [], [query.data]);
  const total = query.data?.total ?? 0;
  const pages = totalPages(total, PAGE_SIZE);

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-5 lg:h-full lg:overflow-hidden">
      <header className="flex shrink-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 truncate text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
            <Users className="size-6 text-blue-500" /> Colaboradores
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {total > 0
              ? `${total} usuario${total !== 1 ? "s" : ""} en el sistema`
              : "Usuarios del sistema y su avance de tareas"}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleDark}
          aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </header>

      {/* Búsqueda por nombre, apellido o correo */}
      <div className="relative max-w-md shrink-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => {
            handleSearchChange(e.target.value);
          }}
          placeholder="Buscar por nombre o correo…"
          aria-label="Buscar colaborador"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/20"
        />
      </div>

      {query.isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : query.isError ? (
        <ErrorState
          title="No se pudieron cargar los colaboradores"
          hint="Hubo un problema al obtener la lista de usuarios."
          onRetry={() => void query.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={User}
          title={debouncedSearch ? "Sin resultados" : "Aún no hay usuarios"}
          hint={
            debouncedSearch
              ? `Ningún colaborador coincide con «${debouncedSearch}».`
              : "Cuando se creen usuarios en el sistema, aparecerán aquí."
          }
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:bg-slate-800/60 dark:text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Colaborador</th>
                  <th className="px-4 py-2.5">Cargo</th>
                  <th className="px-4 py-2.5">Tareas completadas</th>
                  <th className="px-4 py-2.5 text-right">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <CollaboratorRow
                    key={c.user_id}
                    collaborator={c}
                    onOpen={() => void navigate(`/collaborators/${c.user_id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div className="flex shrink-0 items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              Página {page} de {pages}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1));
                }}
                aria-label="Página anterior"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => {
                  setPage((p) => Math.min(pages, p + 1));
                }}
                aria-label="Página siguiente"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
