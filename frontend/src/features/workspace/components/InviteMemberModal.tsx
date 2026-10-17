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
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
            <UserPlus className="size-4 text-brand-gold" /> Invitar integrante
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="mt-3 text-[12px] text-muted-foreground">
          Solo puedes invitar a personas que ya son integrantes del proyecto. La persona recibirá la
          invitación y decide si se une.
        </p>

        <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Integrante del proyecto
        </label>
        <select
          value={userId}
          onChange={(e) => {
            setUserId(e.target.value);
          }}
          disabled={options.length === 0}
          className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none"
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

        <div className="mt-5 flex gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:bg-accent"
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
