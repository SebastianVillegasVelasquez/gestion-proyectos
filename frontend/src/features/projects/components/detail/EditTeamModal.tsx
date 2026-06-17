import { useState } from "react";
import { X, Pencil } from "lucide-react";
import { getErrorMessage } from "@/utils/get-error-message";
import { useUpdateTeam } from "../../hooks/use-teams";
import type { Team, UpdateTeamPayload } from "../../types/api.types";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-violet-500/20";

// Modal para editar el nombre y la descripción de un equipo.
// La validación de unicidad del nombre la resuelve el backend (409); aquí solo
// validamos lo mínimo en cliente y mostramos mensajes claros.
export function EditTeamModal({ team, onClose }: { team: Team; onClose: () => void }) {
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? "");
  const updateTeam = useUpdateTeam(team.id);

  const trimmedName = name.trim();
  const canSubmit = trimmedName.length >= 2 && !updateTeam.isPending;

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }
    const payload: UpdateTeamPayload = {
      name: trimmedName,
      description: description.trim() || null,
    };
    updateTeam.mutate(payload, { onSuccess: onClose });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Editar equipo"
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-50">
            <Pencil className="size-4 text-violet-600" /> Editar equipo
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
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Nombre</span>
            <input
              className={inputCls}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
              placeholder="Nombre del equipo"
              aria-label="Nombre del equipo"
              maxLength={150}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Descripción <span className="text-slate-400">(opcional)</span>
            </span>
            <textarea
              className={`${inputCls} min-h-[5rem] resize-y`}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
              }}
              placeholder="Para qué sirve este equipo…"
              aria-label="Descripción del equipo"
            />
          </label>

          {updateTeam.isError && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {getErrorMessage(updateTeam.error, "No se pudo guardar el equipo")}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {updateTeam.isPending ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
