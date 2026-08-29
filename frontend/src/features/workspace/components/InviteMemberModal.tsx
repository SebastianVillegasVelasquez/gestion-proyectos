import { useMemo, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { getErrorMessage } from "@/utils/get-error-message";
import { useProjectMembers } from "@/features/projects/hooks/use-members";
import { useInviteToTeam } from "../hooks/use-invitations";

/**
 * El líder invita a un integrante DEL PROYECTO a su equipo. La persona no entra
 * hasta que acepta. Solo se ofrecen integrantes del proyecto que aún no están
 * en el equipo (regla del backend: no se puede invitar a alguien de fuera).
 */
export function InviteMemberModal({
  projectId,
  teamId,
  memberUserIds,
  onClose,
}: {
  projectId: string;
  teamId: string;
  /** user_id de quienes YA están en el equipo (para excluirlos). */
  memberUserIds: string[];
  onClose: () => void;
}) {
  const membersQuery = useProjectMembers(projectId);
  const invite = useInviteToTeam(projectId, teamId);
  const [userId, setUserId] = useState("");

  const options = useMemo(() => {
    const inTeam = new Set(memberUserIds);
    return (membersQuery.data ?? [])
      .filter((m) => !inTeam.has(m.user_id))
      .sort((a, b) => `${a.name} ${a.last_name}`.localeCompare(`${b.name} ${b.last_name}`));
  }, [membersQuery.data, memberUserIds]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100">
            <UserPlus className="size-4 text-brand-gold" /> Invitar integrante
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="mt-3 text-[12px] text-slate-500 dark:text-slate-400">
          Solo puedes invitar a personas que ya son integrantes del proyecto. La persona recibirá la
          invitación y decide si se une.
        </p>

        <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Integrante del proyecto
        </label>
        <select
          value={userId}
          onChange={(e) => {
            setUserId(e.target.value);
          }}
          disabled={options.length === 0}
          className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="">
            {options.length === 0
              ? "Todos los integrantes del proyecto ya están en el equipo"
              : "Elige a quién invitar…"}
          </option>
          {options.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.name} {m.last_name} · {m.position}
            </option>
          ))}
        </select>

        {invite.isError && (
          <p role="alert" className="mt-2 text-[12px] text-rose-600 dark:text-rose-400">
            {getErrorMessage(invite.error, "No se pudo enviar la invitación")}
          </p>
        )}

        <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-200 py-2 text-sm text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!userId || invite.isPending}
            onClick={() => {
              invite.mutate(userId, { onSuccess: onClose });
            }}
            className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-brand-gold-dark disabled:opacity-40"
          >
            {invite.isPending ? "Enviando…" : "Enviar invitación"}
          </button>
        </div>
      </div>
    </div>
  );
}
