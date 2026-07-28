import { useMemo, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { getErrorMessage } from "@/utils/get-error-message";
import { useAddMember, useProjectMembers } from "../../hooks/use-members";
import { PROJECT_ROLE_LABELS, PROJECT_ROLE_ORDER } from "../../types/labels";
import type { DirectoryUser, ProjectRole } from "../../types/api.types";
import { DirectoryUserPicker } from "../DirectoryUserPicker";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-brand-gold/25";

// Agrega un usuario del directorio a un proyecto, con su rol en el proyecto.
// El selector de usuario (búsqueda + filtro por cargo + lista paginada) vive en
// DirectoryUserPicker, compartido con la gestión de integrantes de equipos.
export function AddMemberModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [selected, setSelected] = useState<DirectoryUser | null>(null);
  const [role, setRole] = useState<ProjectRole>("integrante");
  const addMember = useAddMember(projectId);
  const membersQuery = useProjectMembers(projectId);

  // Integrantes ya presentes: se ocultan del selector para no duplicar a nadie.
  const existingIds = useMemo(
    () => (membersQuery.data ?? []).map((m) => m.user_id),
    [membersQuery.data],
  );

  const handleAdd = () => {
    // No agregamos a alguien que ya es integrante (el picker además lo bloquea).
    if (!selected || existingIds.includes(selected.id)) {
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
          <DirectoryUserPicker
            selected={selected}
            onSelect={setSelected}
            excludeIds={existingIds}
            showPositionFilter
          />

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
