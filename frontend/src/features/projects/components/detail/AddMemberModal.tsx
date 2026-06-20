import { useEffect, useMemo, useState } from "react";
import { X, UserPlus, Search, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/get-error-message";
import { useAddMember, useDirectorySearch } from "../../hooks/use-members";
import { useDebouncedValue } from "../../utils/use-debounced-value";
import {
  PROJECT_ROLE_LABELS,
  PROJECT_ROLE_ORDER,
  USER_POSITION_LABELS,
  USER_POSITIONS,
} from "../../types/labels";
import type { DirectoryUser, ProjectRole, UserPosition } from "../../types/api.types";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-brand-gold/25";

const PAGE_SIZE = 6;

export function AddMemberModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<UserPosition | "">("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<DirectoryUser | null>(null);
  const [role, setRole] = useState<ProjectRole>("integrante");

  const debouncedSearch = useDebouncedValue(search);
  const addMember = useAddMember(projectId);

  // Al cambiar el filtro, volvemos a la página 1.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, position]);

  const query = useDirectorySearch({
    search: debouncedSearch,
    position: position || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = useMemo(() => {
    const total = query.data?.total ?? 0;
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  }, [query.data]);

  const handleAdd = () => {
    if (!selected) {
      return;
    }
    addMember.mutate({ userId: selected.id, role }, { onSuccess: onClose });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-50">
            <UserPlus className="size-4 text-brand-teal" /> Agregar integrante
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          {/* Filtros */}
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
              />
            </div>
            <select
              className={`${inputCls} w-36`}
              value={position}
              onChange={(e) => {
                setPosition(e.target.value as UserPosition | "");
              }}
            >
              <option value="">Cargo</option>
              {USER_POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {USER_POSITION_LABELS[p]}
                </option>
              ))}
            </select>
          </div>

          {/* Lista paginada */}
          <div className="min-h-[16rem] rounded-lg border border-slate-200 dark:border-slate-700">
            {query.isLoading ? (
              <div className="flex flex-col gap-1 p-2">
                {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 animate-pulse rounded bg-slate-100 dark:bg-slate-800"
                  />
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
                  const isSel = selected?.id === u.id;
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(u);
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition",
                          isSel
                            ? "bg-brand-gold-light dark:bg-brand-gold/15"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/50",
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
                        {isSel && <Check className="size-4 shrink-0 text-brand-gold-dark" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Paginación */}
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              {query.data?.total ?? 0} usuario{(query.data?.total ?? 0) !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
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
                onClick={() => {
                  setPage((p) => p + 1);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 disabled:opacity-40 dark:border-slate-700"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>

          {/* Rol del integrante seleccionado */}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Rol en el proyecto
            </span>
            <select
              className={inputCls}
              value={role}
              onChange={(e) => {
                setRole(e.target.value as ProjectRole);
              }}
            >
              {PROJECT_ROLE_ORDER.map((r) => (
                <option key={r} value={r}>
                  {PROJECT_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>

          {addMember.isError && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {getErrorMessage(addMember.error, "No se pudo agregar el integrante")}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          <span className="truncate text-xs text-slate-400">
            {selected ? `Seleccionado: ${selected.name} ${selected.last_name}` : "Elige un usuario"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!selected || addMember.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {addMember.isPending ? "Agregando…" : "Agregar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
