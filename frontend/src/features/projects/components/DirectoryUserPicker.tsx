import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDirectorySearch } from "../hooks/use-members";
import { useDebouncedValue } from "../utils/use-debounced-value";
import { USER_POSITION_LABELS, USER_POSITIONS } from "../types/labels";
import type { DirectoryUser, UserPosition } from "../types/api.types";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-brand-gold/25";

interface DirectoryUserPickerProps {
  selected: DirectoryUser | null;
  onSelect: (user: DirectoryUser) => void;
  /** Usuarios ya presentes: se muestran deshabilitados ("Ya está"). */
  excludeIds?: string[];
  /** Muestra el filtro por cargo (útil al asignar tareas/proyectos). */
  showPositionFilter?: boolean;
  pageSize?: number;
}

// Selector reutilizable de usuarios del directorio: búsqueda con debounce,
// filtro opcional por cargo, lista paginada y selección. Encapsula todo el
// estado de búsqueda/paginación para que los modales que lo usan solo manejen
// el usuario seleccionado y la acción final.
export function DirectoryUserPicker({
  selected,
  onSelect,
  excludeIds = [],
  showPositionFilter = false,
  pageSize = 6,
}: DirectoryUserPickerProps) {
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<UserPosition | "">("");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(search);

  // Al cambiar el filtro, volvemos a la página 1.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, position]);

  const query = useDirectorySearch({
    search: debouncedSearch,
    position: position || undefined,
    page,
    pageSize,
  });

  const totalPages = useMemo(() => {
    const total = query.data?.total ?? 0;
    return Math.max(1, Math.ceil(total / pageSize));
  }, [query.data, pageSize]);

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            className={`${inputCls} pl-9`}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            placeholder="Nombre o correo…"
            aria-label="Buscar usuario"
          />
        </div>
        {showPositionFilter && (
          <select
            className={`${inputCls} w-36`}
            value={position}
            onChange={(e) => {
              setPosition(e.target.value as UserPosition | "");
            }}
            aria-label="Filtrar por cargo"
          >
            <option value="">Cargo</option>
            {USER_POSITIONS.map((p) => (
              <option key={p} value={p}>
                {USER_POSITION_LABELS[p]}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="min-h-[16rem] rounded-lg border border-slate-200 dark:border-slate-700">
        {query.isLoading ? (
          <div className="flex flex-col gap-1 p-2">
            {Array.from({ length: pageSize }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : query.isError ? (
          <p className="p-4 text-sm text-red-600 dark:text-red-400">
            No se pudo cargar la lista de usuarios.
          </p>
        ) : (query.data?.items.length ?? 0) === 0 ? (
          <p className="p-4 text-sm italic text-slate-400">Sin resultados.</p>
        ) : (
          <ul className="flex flex-col">
            {query.data?.items.map((u) => {
              const isExcluded = excluded.has(u.id);
              const isSel = selected?.id === u.id;
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    disabled={isExcluded}
                    onClick={() => {
                      onSelect(u);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition",
                      isExcluded && "cursor-not-allowed opacity-50",
                      isSel
                        ? "bg-brand-gold-light dark:bg-brand-gold/15"
                        : !isExcluded && "hover:bg-slate-50 dark:hover:bg-slate-800/50",
                    )}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                      {(u.name[0] ?? "") + (u.last_name[0] ?? "")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-800 dark:text-slate-100">
                        {u.name} {u.last_name}
                      </span>
                      <span className="block truncate text-[11px] text-slate-400">
                        {u.email} · {USER_POSITION_LABELS[u.position]}
                      </span>
                    </span>
                    {isExcluded ? (
                      <span className="shrink-0 text-[10px] text-slate-400">Ya está</span>
                    ) : (
                      isSel && <Check className="size-4 shrink-0 text-brand-gold-dark" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>
          {query.data?.total ?? 0} usuario{(query.data?.total ?? 0) !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            aria-label="Página anterior"
            onClick={() => {
              setPage((p) => p - 1);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 disabled:opacity-40 dark:border-slate-700"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            aria-label="Página siguiente"
            onClick={() => {
              setPage((p) => p + 1);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 disabled:opacity-40 dark:border-slate-700"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
