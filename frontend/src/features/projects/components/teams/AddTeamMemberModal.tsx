import { useState } from "react";
import { UserPlus, X } from "lucide-react";
import { getErrorMessage } from "@/utils/get-error-message";
import { useAddTeamMember } from "../../hooks/use-teams";
import { TEAM_ROLE_LABELS, TEAM_ROLE_ORDER } from "../../types/labels";
import type { DirectoryUser, TeamRole } from "../../types/api.types";
import { DirectoryUserPicker } from "../DirectoryUserPicker";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-violet-500/20";

// Agrega un usuario del directorio a un equipo, con su rol dentro del equipo.
// El selector de usuario (búsqueda + lista paginada) vive en DirectoryUserPicker.
export function AddTeamMemberModal({
  projectId,
  teamId,
  existingIds,
  onClose,
}: {
  projectId: string;
  teamId: string;
  existingIds: string[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<DirectoryUser | null>(null);
  const [role, setRole] = useState<TeamRole>("integrante");
  const addMember = useAddTeamMember(projectId, teamId);

  const handleAdd = () => {
    if (!selected) {
      return;
    }
    addMember.mutate({ user_id: selected.id, team_role: role }, { onSuccess: onClose });
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
            <UserPlus className="size-4 text-violet-600" /> Agregar integrante
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Solo puedes agregar personas que ya sean integrantes del proyecto.
          </p>
          <DirectoryUserPicker
            selected={selected}
            onSelect={setSelected}
            excludeIds={existingIds}
          />

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Rol en el equipo
            </span>
            <select
              className={inputCls}
              value={role}
              onChange={(e) => {
                setRole(e.target.value as TeamRole);
              }}
              aria-label="Rol en el equipo"
            >
              {TEAM_ROLE_ORDER.map((r) => (
                <option key={r} value={r}>
                  {TEAM_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>

          {addMember.isError && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
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
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {addMember.isPending ? "Agregando…" : "Agregar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
