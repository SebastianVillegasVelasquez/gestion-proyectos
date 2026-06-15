import { useState } from "react";
import { X, UserPlus } from "lucide-react";
import { getErrorMessage } from "@/utils/get-error-message";
import { useAddMember, useUsers } from "../../hooks/use-members";
import { PROJECT_ROLE_LABELS, PROJECT_ROLE_ORDER } from "../../types/labels";
import type { ProjectRole } from "../../types/api.types";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-500/20";

export function AddMemberModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const usersQuery = useUsers();
  const addMember = useAddMember(projectId);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<ProjectRole>("integrante");

  const handleSubmit = () => {
    if (!userId) {
      return;
    }
    addMember.mutate(
      { userId, role },
      {
        onSuccess: onClose,
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-50">
            <UserPlus className="size-4 text-blue-600" /> Agregar integrante
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Usuario</span>
            {usersQuery.isLoading ? (
              <div className="h-9 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            ) : usersQuery.isError ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                No se pudo cargar la lista de usuarios (¿permisos de administrador?).
              </p>
            ) : (
              <select
                className={inputCls}
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                }}
              >
                <option value="">Selecciona un usuario…</option>
                {usersQuery.data?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.last_name} — {u.email}
                  </option>
                ))}
              </select>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Rol</span>
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

          <div className="mt-2 flex justify-end gap-2">
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
              disabled={!userId || addMember.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {addMember.isPending ? "Agregando…" : "Agregar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
